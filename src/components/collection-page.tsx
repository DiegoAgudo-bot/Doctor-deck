"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CollectionCardDTO, StatusResponse } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { AddCards, type AddedRow } from "./collection-add";
import { CollectionBrowser } from "./collection-browser";
import { CsvImport, uploadCsv } from "./collection-import";
import {
  COLLECTION_EVENT,
  LOCAL_COLLECTION_EVENT,
  localCollection,
  localCopies,
  notifyCollectionChanged,
  ownedPairs,
  type LocalCollection,
} from "./local-collection";
import { Banner, EmptyState, Loading, fmt } from "./ui";

type Tab = "cartas" | "anadir" | "importar";

/** /coleccion: ver la colección con filtros, añadir cartas sueltas e importar el CSV de ManaBox. */
export function CollectionPage() {
  const { data, isPending } = authClient.useSession();
  const loggedIn = Boolean(data);
  const [tab, setTab] = useState<Tab>("cartas");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [local, setLocal] = useState<LocalCollection | null>(null);
  const [view, setView] = useState<CollectionCardDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    const l = localCollection.get();
    setLocal(l);
    try {
      const [cards, st] = await Promise.all([
        api<CollectionCardDTO[]>("/api/collection/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loggedIn || !l ? {} : { collection: ownedPairs(l) }),
        }),
        loggedIn ? api<StatusResponse>("/api/status") : Promise.resolve(null),
      ]);
      setView(cards);
      setStatus(st);
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
    if (view && view.length === 0) setTab((t) => (t === "cartas" ? "importar" : t));
  }, [view]);

  /** Pasa la colección de este navegador (CSV y sueltas) a la cuenta recién creada. */
  async function moveToAccount(l: LocalCollection) {
    setMoving(true);
    setError(null);
    try {
      if (l.import?.csv) await uploadCsv(l.import.csv, l.import.fileName, true);
      if (l.added.length > 0) {
        await api("/api/collection/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cards: l.added.map((a) => ({
              oracleId: a.oracleId,
              quantity: a.quantity,
              foil: a.foil,
            })),
          }),
        });
      }
      localCollection.clear();
      notifyCollectionChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo pasar la colección a tu cuenta");
    } finally {
      setMoving(false);
    }
  }

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

  // Lo añadido a mano: de la cuenta (vista agrupada) o del navegador.
  const byId = new Map((view ?? []).map((c) => [c.card.oracleId, c.card]));
  const added: AddedRow[] = loggedIn
    ? (view ?? [])
        .flatMap((c) =>
          c.manual.map((m) => ({
            id: m.id,
            card: c.card,
            name: c.card.name,
            quantity: m.quantity,
            foil: m.foil,
            addedAt: m.addedAt,
          })),
        )
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    : (local?.added ?? []).map((a) => ({ ...a, card: byId.get(a.oracleId) ?? null }));

  const copies = (view ?? []).reduce((n, c) => n + c.quantity, 0);
  const value = (view ?? []).reduce((n, c) => n + (c.price ?? 0) * c.quantity, 0);
  const tabs: [Tab, string, number | null][] = [
    ["cartas", "Mis cartas", view?.length ?? null],
    ["anadir", "Añadir cartas", null],
    ["importar", "Importar CSV", null],
  ];

  return (
    <main className="page max-w-[1240px]">
      <div className="stack-sm flex items-end justify-between gap-3">
        <h1 className="h1">Mi colección</h1>
        {view && view.length > 0 && (
          <span className="muted text-[13px]">
            <b className="mono" style={{ color: "var(--color-text)" }}>
              {fmt(copies)}
            </b>{" "}
            copias · {fmt(view.length)} cartas distintas
            {value > 0 && <> · valor aprox. {formatEuros(value)}</>}
          </span>
        )}
      </div>

      {!isPending && !loggedIn && (
        <Banner
          tone="info"
          action={
            <Link className="btn btn-sm" href="/registro?next=/coleccion">
              Crear cuenta
            </Link>
          }
        >
          <b>Sin cuenta, tu colección se guarda solo en este navegador.</b>{" "}
          <span className="muted">Con una cuenta la tendrás en cualquier dispositivo.</span>
        </Banner>
      )}
      {loggedIn && local && (
        <Banner
          tone="info"
          action={
            local.import && !local.import.csv ? (
              <button type="button" className="btn btn-sm" onClick={() => localCollection.clear()}>
                Olvidarla
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={moving}
                onClick={() => void moveToAccount(local)}
              >
                {moving ? "Guardando…" : "Guardarla en mi cuenta"}
              </button>
            )
          }
        >
          <b>Tienes una colección guardada en este navegador</b>{" "}
          <span className="muted">
            ({fmt(localCopies(local))} copias
            {local.import ? `, ${local.import.fileName}` : ""}).{" "}
            {local.import && !local.import.csv
              ? "Era demasiado grande para guardarla: vuelve a subir el CSV."
              : "Puedes pasarla a tu cuenta."}
          </span>
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
        (view === null ? (
          <Loading>Cargando tu colección…</Loading>
        ) : view.length === 0 ? (
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
                    Importar CSV de ManaBox
                  </button>
                  <button type="button" className="btn" onClick={() => setTab("anadir")}>
                    Añadir cartas a mano
                  </button>
                </div>
              }
            >
              Importa el CSV de ManaBox o añade cartas una a una.
            </EmptyState>
          </div>
        ) : (
          <CollectionBrowser cards={view} loggedIn={loggedIn} />
        ))}
      {tab === "anadir" && <AddCards loggedIn={loggedIn} added={added} onRemove={removeAdded} />}
      {tab === "importar" && <CsvImport loggedIn={loggedIn} status={status} local={local} />}
    </main>
  );
}
