"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedDeckDTO, SavedDeckSummaryDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { DeckTile } from "./deck-tile";
import { nextVisibility, setDeckVisibility } from "./deck-visibility";
import { IconEye, IconPlus } from "./icons";
import { DECKS_EVENT, notifyDecksChanged } from "./local-collection";
import { Banner, Dialog, EmptyState, Loading } from "./ui";

export function SavedDecks() {
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [toDelete, setToDelete] = useState<SavedDeckSummaryDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toRename, setToRename] = useState<SavedDeckSummaryDTO | null>(null);
  const [newName, setNewName] = useState("");
  const [working, setWorking] = useState(false);

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
      const { visibility } = await setDeckVisibility(api, d.id, nextVisibility(d.visibility));
      setDecks((list) => list?.map((x) => (x.id === d.id ? { ...x, visibility } : x)) ?? null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "No se pudo cambiar la visibilidad");
    }
  }

  async function rename() {
    if (!toRename || !newName.trim()) return;
    setWorking(true);
    try {
      await api(`/api/decks/${toRename.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const id = toRename.id;
      setDecks(
        (list) => list?.map((x) => (x.id === id ? { ...x, name: newName.trim() } : x)) ?? null,
      );
      setToRename(null);
      notifyDecksChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cambiar el nombre");
    } finally {
      setWorking(false);
    }
  }

  /** Copia el mazo (lista, tema, candados y descartes) como uno nuevo y privado. */
  async function duplicate(d: SavedDeckSummaryDTO) {
    setWorking(true);
    try {
      const full = await api<SavedDeckDTO>(`/api/decks/${d.id}`);
      await api("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${d.name} (copia)`.slice(0, 120),
          input: full.input,
          ...(full.theme ? { theme: full.theme } : {}),
          commanders: full.commanders,
          locked: full.locked,
          excluded: full.excluded,
          visibility: "private",
        }),
      });
      notifyDecksChanged();
      setToast(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo duplicar el mazo");
    } finally {
      setWorking(false);
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
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href="/mazo?nuevo=1">
            Importar lista
          </Link>
          <Link className="btn btn-primary" href="/mazos/nuevo">
            <IconPlus size={14} />
            Nuevo mazo
          </Link>
        </div>
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
            title="Aún no tienes ningún mazo"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className="btn btn-primary" href="/mazos/nuevo">
                  Crear desde un comandante
                </Link>
                <Link className="btn" href="/mazo?nuevo=1">
                  Importar una lista
                </Link>
              </div>
            }
          >
            Elige un comandante y te monto el mazo con EDHREC, empieza desde cero o importa tu
            lista.
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
                  onRename={() => {
                    setNewName(d.name);
                    setToRename(d);
                  }}
                  onDuplicate={working ? undefined : () => void duplicate(d)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={toRename !== null}
        onClose={() => setToRename(null)}
        title="Cambiar el nombre"
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setToRename(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={working || !newName.trim()}
              onClick={() => void rename()}
            >
              Guardar nombre
            </button>
          </>
        }
      >
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <label className="label" htmlFor="rename">
            Nombre
          </label>
          <input
            id="rename"
            className="input"
            value={newName}
            maxLength={120}
            onChange={(e) => setNewName(e.target.value)}
          />
        </form>
      </Dialog>

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
