"use client";

import { useEffect, useState } from "react";
import type { SavedDeckDTO, SavedDeckSummaryDTO } from "@/server/dto";
import { swr } from "./swr-cache";
import { api, ApiError } from "./api-client";
import { DeckTile } from "./deck-tile";
import { nextVisibility, setDeckVisibility } from "./deck-visibility";
import { IconEye, IconPlus } from "./icons";
import { DECKS_EVENT, notifyDecksChanged } from "./local-collection";
import { Banner, Dialog, EmptyState, TilesSkeleton } from "./ui";
import { Link, useT } from "@/components/i18n";

export function SavedDecks() {
  const t = useT();
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [toDelete, setToDelete] = useState<SavedDeckSummaryDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toRename, setToRename] = useState<SavedDeckSummaryDTO | null>(null);
  const [newName, setNewName] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    // Lo de la última vez al momento; después, lo nuevo.
    const load = () =>
      swr("decks", () => api<SavedDeckSummaryDTO[]>("/api/decks"), setDecks).catch((e: unknown) =>
        setError(
          e instanceof ApiError
            ? e.message
            : t("No se pudieron cargar los mazos", "Couldn't load the decks"),
        ),
      );
    void load();
    window.addEventListener(DECKS_EVENT, load);
    return () => window.removeEventListener(DECKS_EVENT, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma (recarga)
  }, []);

  async function toggle(d: SavedDeckSummaryDTO) {
    try {
      const { visibility } = await setDeckVisibility(api, d.id, nextVisibility(d.visibility));
      setDecks((list) => list?.map((x) => (x.id === d.id ? { ...x, visibility } : x)) ?? null);
    } catch (e: unknown) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo cambiar la visibilidad", "Couldn't change who can see it"),
      );
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
      setError(
        e instanceof ApiError ? e.message : t("No se pudo cambiar el nombre", "Couldn't rename it"),
      );
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
          name: `${d.name} ${t("(copia)", "(copy)")}`.slice(0, 120),
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
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo duplicar el mazo", "Couldn't duplicate the deck"),
      );
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
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo borrar el mazo", "Couldn't delete the deck"),
      );
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
    <main className="page">
      <div className="stack-sm flex items-center justify-between gap-3">
        <h1 className="h1">
          {t("Mis mazos", "My decks")}{" "}
          {decks && (
            <span className="mono subtle" style={{ fontSize: 16, fontWeight: 400 }}>
              {decks.length}
            </span>
          )}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href="/decks/new?from=list">
            {t("Importar lista", "Import list")}
          </Link>
          <Link className="btn btn-primary" href="/decks/new">
            <IconPlus size={14} />
            {t("Nuevo mazo", "New deck")}
          </Link>
        </div>
      </div>
      <p className="muted text-[13px]">
        {t(
          "Las cartas de estos mazos cuentan como «en uso» al buscar mejoras para los demás. Los públicos",
          "The cards in these decks count as “in use” when looking for improvements for the others. Public ones",
        )}{" "}
        (<IconEye size={12} style={{ display: "inline" }} />){" "}
        {t(
          "salen en tu perfil; los privados solo los ves tú.",
          "show on your profile; private ones are only visible to you.",
        )}
      </p>

      {error && <Banner tone="out">{error}</Banner>}
      {toast && (
        <Banner
          tone="in"
          action={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToast(null)}>
              {t("Vale", "OK")}
            </button>
          }
        >
          {t("Has borrado", "You deleted")} <b>{toast}</b>.
        </Banner>
      )}

      {!decks && !error && (
        <TilesSkeleton label={t("Cargando tus mazos…", "Loading your decks…")} />
      )}

      {decks && decks.length === 0 && (
        <div className="panel">
          <EmptyState
            title={t("Aún no tienes ningún mazo", "You don't have any decks yet")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className="btn btn-primary" href="/decks/new">
                  {t("Crear desde un comandante", "Build from a commander")}
                </Link>
                <Link className="btn" href="/decks/new?from=list">
                  {t("Importar una lista", "Import a list")}
                </Link>
              </div>
            }
          >
            {t(
              "Elige un comandante y te monto el mazo con lo que juega la comunidad, empieza desde cero o importa tu lista.",
              "Pick a commander and I'll build the deck with what the community plays, start from scratch, or import your list.",
            )}
          </EmptyState>
        </div>
      )}

      {decks && decks.length > 0 && (
        <>
          {decks.length > 4 && (
            <input
              className="input"
              placeholder={t("Filtrar por nombre o comandante", "Filter by name or commander")}
              aria-label={t("Filtrar mazos", "Filter decks")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          )}
          {shown.length === 0 ? (
            <div className="panel flex flex-col items-center gap-2.5 px-5 py-9 text-center">
              <span className="mono subtle text-[13px]">
                {t(`0 mazos que contengan «${filter}»`, `0 decks containing “${filter}”`)}
              </span>
              <span className="muted text-[13px]">
                {t(
                  "Prueba con el nombre del mazo o del comandante.",
                  "Try the deck's or the commander's name.",
                )}
              </span>
              <button type="button" className="btn" onClick={() => setFilter("")}>
                {t("Quitar el filtro", "Clear the filter")}
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
        title={t("Cambiar el nombre", "Rename")}
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setToRename(null)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={working || !newName.trim()}
              onClick={() => void rename()}
            >
              {t("Guardar nombre", "Save name")}
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
            {t("Nombre", "Name")}
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
        title={t("Borrar mazo", "Delete deck")}
        width={380}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setToDelete(null)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-out"
              onClick={() => toDelete && void remove(toDelete)}
            >
              {t("Borrar", "Delete")}
            </button>
          </>
        }
      >
        <p>
          {t("¿Borrar", "Delete")} <b>{toDelete?.name}</b>
          {t(
            "? Sus cartas dejarán de contar como en uso. No se puede deshacer.",
            "? Its cards will no longer count as in use. This can't be undone.",
          )}
        </p>
      </Dialog>
    </main>
  );
}
