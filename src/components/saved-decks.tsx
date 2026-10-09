"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { IconPlus, IconTrash } from "./icons";
import { DECKS_EVENT, notifyDecksChanged } from "./local-collection";
import { ColorPips } from "./mana";
import { Banner, Dialog, EmptyState, Loading, ago } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  text: "Texto",
  archidekt: "Archidekt",
  moxfield: "Moxfield",
};

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
        Las cartas de estos mazos cuentan como «en uso» al buscar mejoras para los demás.
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
                <div
                  key={d.id}
                  className="fade relative"
                  style={{ ["--d" as string]: `${i * 40}ms` }}
                >
                  <Link className="deckcard" href={`/decks/${d.id}`}>
                    <div style={{ width: 74, flex: "none" }}>
                      {d.commanderCard ? (
                        <CardImage card={d.commanderCard} />
                      ) : (
                        <div className="cardimg cardimg-missing" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</span>
                      <span className="muted flex flex-wrap items-center gap-2">
                        <span className="truncate">{d.commanderNames.join(" + ")}</span>
                        <ColorPips colors={d.colorIdentity} />
                      </span>
                      <span className="mono subtle flex flex-wrap gap-3 text-xs">
                        <span>{SOURCE_LABEL[d.source] ?? d.source}</span>
                        <span>{d.cardCount} cartas</span>
                        <span>{ago(d.updatedAt)}</span>
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon absolute"
                    style={{ top: 8, right: 8, width: 28, height: 28 }}
                    aria-label={`Borrar ${d.name}`}
                    onClick={() => setToDelete(d)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
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
