"use client";

import Link from "next/link";
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

type Tab = "cartas" | "precios" | "anadir" | "importar";

/** /collection: ver la colección con filtros, añadir cartas sueltas e importar el CSV de ManaBox. */
export function CollectionPage() {
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
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la colección");
    }
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
      setError(err instanceof ApiError ? err.message : "No se pudo quitar la carta");
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
    ["cartas", "Mis cartas", overall?.cards ?? null],
    ["precios", "Precios", null],
    ["anadir", "Añadir cartas", null],
    ["importar", "Importar CSV", null],
  ];

  return (
    <main className="page">
      <div className="stack-sm flex items-end justify-between gap-3">
        <h1 className="h1">Mi colección</h1>
        {overall && overall.cards > 0 && (
          <span className="muted text-[13px]">
            <b className="mono" style={{ color: "var(--color-text)" }}>
              {fmt(copies)}
            </b>{" "}
            copias · {fmt(overall.cards)} cartas distintas
            {value > 0 && <> · valor aprox. {formatEuros(value)}</>}
            {" · "}
            <Link href="/community?sort=owned" title="Mazos públicos ordenados por cuánto tienes">
              Mazos que puedes montar
            </Link>
            {loggedIn && (
              <>
                {" · "}
                <a
                  href="/api/collection/export"
                  download
                  title="Tu colección en CSV, para llevarla a otra app"
                >
                  Exportar CSV
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
            <Link className="btn btn-sm" href="/signup?next=/collection">
              Crear cuenta
            </Link>
          }
        >
          <b>Sin cuenta, tu colección se guarda solo en este navegador.</b>{" "}
          <span className="muted">Con una cuenta la tendrás en cualquier dispositivo.</span>
        </Banner>
      )}
      {error && <Banner tone="out">{error}</Banner>}

      <nav className="tabs" aria-label="Secciones de la colección">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {n !== null && <span className="n">{fmt(n)}</span>}
          </button>
        ))}
      </nav>

      {tab === "cartas" &&
        (overall === null ? (
          <CardGridSkeleton label="Cargando tu colección…" />
        ) : overall.cards === 0 ? (
          <div className="panel">
            <EmptyState
              title="Tu colección está vacía"
              action={
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setTab("importar")}
                  >
                    Importar un CSV
                  </button>
                  <button type="button" className="btn" onClick={() => setTab("anadir")}>
                    Añadir cartas a mano
                  </button>
                </div>
              }
            >
              Importa el CSV de tu colección o añade cartas una a una.
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
