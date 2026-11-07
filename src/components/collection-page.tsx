"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type {
  AddedCardDTO,
  CollectionTotals,
  CollectionViewResponse,
  StatusResponse,
} from "@/server/dto";
import { readCached, writeCached } from "./swr-cache";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { AddCards, type AddedRow } from "./collection-add";
import { CollectionBrowser } from "./collection-browser";
import { CollectionPrices } from "./collection-prices";
import { CsvImport } from "./collection-import";
import {
  COLLECTION_EVENT,
  LOCAL_COLLECTION_EVENT,
  localCollection,
  notifyCollectionChanged,
  ownedPairs,
  type LocalCollection,
} from "./local-collection";
import { Banner, CardGridSkeleton, EmptyState, fmt } from "./ui";
import { Link, useLocale, useLocalePath, useT } from "@/components/i18n";

type Tab = "cartas" | "precios" | "anadir" | "importar";

/** /collection: ver la colección con filtros, añadir cartas sueltas e importar el CSV de ManaBox. */
export function CollectionPage() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocalePath();
  const n = (x: number) => fmt(x, locale);
  const { data, isPending } = authClient.useSession();
  const loggedIn = Boolean(data);
  const [tab, setTab] = useState<Tab>("cartas");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [local, setLocal] = useState<LocalCollection | null>(null);
  /** Totales de toda la colección (la lista la pide CollectionBrowser por páginas). */
  const [overall, setOverall] = useState<CollectionTotals | null>(null);
  const [accountAdded, setAccountAdded] = useState<AddedCardDTO[]>([]);
  /** Cambia cada vez que cambia la colección, para que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const l = localCollection.get();
    setLocal(l);
    setVersion((v) => v + 1);
    // Con cuenta, los totales de la última vez al momento (la lista hace lo mismo).
    const cachedTotals = loggedIn ? readCached<CollectionTotals>("collection-overall") : null;
    if (cachedTotals) setOverall((o) => o ?? cachedTotals);
    try {
      const [view, st, added] = await Promise.all([
        api<CollectionViewResponse>("/api/collection/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: 0,
            ...(loggedIn || !l ? {} : { collection: ownedPairs(l) }),
          }),
        }),
        loggedIn ? api<StatusResponse>("/api/status") : Promise.resolve(null),
        loggedIn ? api<AddedCardDTO[]>("/api/collection/cards") : Promise.resolve([]),
      ]);
      setOverall(view.overall);
      if (loggedIn) writeCached("collection-overall", view.overall);
      setStatus(st);
      setAccountAdded(added);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo cargar la colección", "Couldn't load the collection"),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma (recarga)
  }, [loggedIn]);

  useEffect(() => {
    if (isPending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial y al cambiar
    void load();
    const reload = () => void load();
    window.addEventListener(LOCAL_COLLECTION_EVENT, reload);
    window.addEventListener(COLLECTION_EVENT, reload);
    return () => {
      window.removeEventListener(LOCAL_COLLECTION_EVENT, reload);
      window.removeEventListener(COLLECTION_EVENT, reload);
    };
  }, [isPending, load]);

  // Colección vacía: directamente a importar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo la primera vez que llega vacía
    if (overall && overall.cards === 0) setTab((t) => (t === "cartas" ? "importar" : t));
  }, [overall]);

  async function removeAdded(id: string) {
    if (!loggedIn) {
      localCollection.removeAdded(id);
      return;
    }
    try {
      await api(`/api/collection/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
      notifyCollectionChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("No se pudo quitar la carta", "Couldn't remove the card"),
      );
    }
  }

  // Lo añadido a mano: de la cuenta o del navegador (sin imagen hasta que se conozca la carta).
  const added: AddedRow[] = loggedIn
    ? accountAdded.map((a) => ({ ...a, name: a.card.name }))
    : (local?.added ?? []).map((a) => ({ ...a, card: null }));

  // Memorizado: si no, cada render daría un array nuevo y la lista se volvería a pedir sin parar.
  const localPairs = useMemo(() => (local ? ownedPairs(local) : null), [local]);
  const copies = overall?.copies ?? 0;
  const value = overall?.value ?? 0;
  const tabs: [Tab, string, number | null][] = [
    ["cartas", t("Mis cartas", "My cards"), overall?.cards ?? null],
    ["precios", t("Precios", "Prices"), null],
    ["anadir", t("Añadir cartas", "Add cards"), null],
    ["importar", t("Importar CSV", "Import CSV"), null],
  ];

  return (
    <main className="page">
      <div className="stack-sm flex items-end justify-between gap-3">
        <h1 className="h1">{t("Mi colección", "My collection")}</h1>
        {overall && overall.cards > 0 && (
          <span className="muted text-[13px]">
            <b className="mono" style={{ color: "var(--color-text)" }}>
              {n(copies)}
            </b>{" "}
            {t("copias", "copies")} · {n(overall.cards)} {t("cartas distintas", "unique cards")}
            {value > 0 && (
              <>
                {" "}
                · {t("valor aprox.", "approx. value")} {formatEuros(value, locale)}
              </>
            )}
            {" · "}
            <Link
              href="/community?sort=owned"
              title={t(
                "Mazos públicos ordenados por cuánto tienes",
                "Public decks sorted by how much you own",
              )}
            >
              {t("Mazos que puedes montar", "Decks you can build")}
            </Link>
            {loggedIn && (
              <>
                {" · "}
                <a
                  href="/api/collection/export"
                  download
                  title={t(
                    "Tu colección en CSV, para llevarla a otra app",
                    "Your collection as CSV, to take to another app",
                  )}
                >
                  {t("Exportar CSV", "Export CSV")}
                </a>
              </>
            )}
          </span>
        )}
      </div>

      {!isPending && !loggedIn && (
        <Banner
          tone="info"
          action={
            <Link
              className="btn btn-sm"
              href={`/signup?next=${encodeURIComponent(lp("/collection"))}`}
            >
              {t("Crear cuenta", "Create account")}
            </Link>
          }
        >
          <b>
            {t(
              "Sin cuenta, tu colección se guarda solo en este navegador.",
              "Without an account, your collection is only saved in this browser.",
            )}
          </b>{" "}
          <span className="muted">
            {t(
              "Con una cuenta la tendrás en cualquier dispositivo.",
              "With an account you'll have it on any device.",
            )}
          </span>
        </Banner>
      )}
      {error && <Banner tone="out">{error}</Banner>}

      <nav className="tabs" aria-label={t("Secciones de la colección", "Collection sections")}>
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {count !== null && <span className="n">{n(count)}</span>}
          </button>
        ))}
      </nav>

      {tab === "cartas" &&
        (overall === null ? (
          <CardGridSkeleton label={t("Cargando tu colección…", "Loading your collection…")} />
        ) : overall.cards === 0 ? (
          <div className="panel">
            <EmptyState
              title={t("Tu colección está vacía", "Your collection is empty")}
              action={
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setTab("importar")}
                  >
                    {t("Importar un CSV", "Import a CSV")}
                  </button>
                  <button type="button" className="btn" onClick={() => setTab("anadir")}>
                    {t("Añadir cartas a mano", "Add cards by hand")}
                  </button>
                </div>
              }
            >
              {t(
                "Importa el CSV de tu colección o añade cartas una a una.",
                "Import your collection's CSV or add cards one by one.",
              )}
            </EmptyState>
          </div>
        ) : (
          <CollectionBrowser loggedIn={loggedIn} localPairs={localPairs} version={version} />
        ))}
      {tab === "precios" && <CollectionPrices loggedIn={loggedIn} localPairs={localPairs} />}
      {tab === "anadir" && <AddCards loggedIn={loggedIn} added={added} onRemove={removeAdded} />}
      {tab === "importar" && <CsvImport loggedIn={loggedIn} status={status} local={local} />}
    </main>
  );
}
