"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { DeckTile, setDeckVisibility } from "./deck-tile";
import { IconEye, IconPlus } from "./icons";
import { DECKS_EVENT, notifyDecksChanged } from "./local-collection";
import { Banner, Dialog, EmptyState, Loading } from "./ui";

export function SavedDecks() {
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [toDelete, setToDelete] = useState<SavedDeckSummaryDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<SavedDeckSummaryDTO[]>("/api/decks")
        .then(setDecks)
        .catch((e: unknown) =>
          setError(e instanceof ApiError ? e.message : "No se pudieron cargar los mazos"),
        );
    void load();
    window.addEventListener(DECKS_EVENT, load);
    return () => window.removeEventListener(DECKS_EVENT, load);
  }, []);

  async function toggle(d: SavedDeckSummaryDTO) {
    try {
      const { isPublic } = await setDeckVisibility(api, d.id, !d.isPublic);
      setDecks((list) => list?.map((x) => (x.id === d.id ? { ...x, isPublic } : x)) ?? null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "No se pudo cambiar la visibilidad");
    }
  }

  async function remove(d: SavedDeckSummaryDTO) {
    setToDelete(null);
    try {
      await api<unknown>(`/api/decks/${d.id}`, { method: "DELETE" });
      setDecks((list) => list?.filter((x) => x.id !== d.id) ?? null);
      setToast(d.name);
      notifyDecksChanged();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "No se pudo borrar el mazo");
    }
  }

  const q = filter.trim().toLowerCase();
  const shown = (decks ?? []).filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.commanderNames.some((n) => n.toLowerCase().includes(q)),
  );

  return (
    <main className="page max-w-[1100px]">
      <div className="stack-sm flex items-center justify-between gap-3">
        <h1 className="h1">
          Mis mazos{" "}
          {decks && (
            <span className="mono subtle" style={{ fontSize: 16, fontWeight: 400 }}>
              {decks.length}
            </span>
          )}
        </h1>
        <Link className="btn btn-primary" href="/mazo?nuevo=1">
          <IconPlus size={14} />
          Analizar mazo
        </Link>
      </div>
      <p className="muted text-[13px]">
        Las cartas de estos mazos cuentan como «en uso» al buscar mejoras para los demás. Los
        públicos (<IconEye size={12} style={{ display: "inline" }} />) salen en tu perfil; los
        privados solo los ves tú.
      </p>

      {error && <Banner tone="out">{error}</Banner>}
      {toast && (
        <Banner
          tone="in"
          action={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToast(null)}>
              Vale
            </button>
          }
        >
          Has borrado <b>{toast}</b>.
        </Banner>
      )}

      {!decks && !error && <Loading>Cargando tus mazos…</Loading>}

      {decks && decks.length === 0 && (
        <div className="panel">
          <EmptyState
            title="Aún no has guardado ningún mazo"
            action={
              <Link className="btn btn-primary" href="/mazo?nuevo=1">
                Analizar mazo
              </Link>
            }
          >
            Analiza uno y pulsa Guardar en su cabecera.
          </EmptyState>
        </div>
      )}

      {decks && decks.length > 0 && (
        <>
          {decks.length > 4 && (
            <input
              className="input"
              placeholder="Filtrar por nombre o comandante"
              aria-label="Filtrar mazos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          )}
          {shown.length === 0 ? (
            <div className="panel flex flex-col items-center gap-2.5 px-5 py-9 text-center">
              <span className="mono subtle text-[13px]">0 mazos que contengan «{filter}»</span>
              <span className="muted text-[13px]">
                Prueba con el nombre del mazo o del comandante.
              </span>
              <button type="button" className="btn" onClick={() => setFilter("")}>
                Quitar el filtro
              </button>
            </div>
          ) : (
            <div
              className="grid-1-sm grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {shown.map((d, i) => (
                <DeckTile
                  key={d.id}
                  deck={d}
                  delay={i * 40}
                  onToggleVisibility={() => void toggle(d)}
                  onDelete={() => setToDelete(d)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Borrar mazo"
        width={380}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setToDelete(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-out"
              onClick={() => toDelete && void remove(toDelete)}
            >
              Borrar
            </button>
          </>
        }
      >
        <p>
          ¿Borrar <b>{toDelete?.name}</b>? Sus cartas dejarán de contar como en uso. No se puede
          deshacer.
        </p>
      </Dialog>
    </main>
  );
}
