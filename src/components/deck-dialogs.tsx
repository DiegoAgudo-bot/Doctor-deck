"use client";

import { useEffect, useState } from "react";
import { exportDeck, type ExportableDeck, type ExportFormat } from "@/domain/deck/export";
import type { DeckVisibility } from "@/domain/deck/visibility";
import type { DeckVersionDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { VisibilityPicker } from "./deck-visibility";
import { Banner, Dialog, Loading } from "./ui";
import { Link, useIntlLocale, useLocalePath, useT, type T } from "@/components/i18n";

/** Guardar en "Mis mazos". Sin sesión, invita a entrar (el mazo sigue en el navegador). */
export function SaveDialog({
  open,
  onClose,
  loggedIn,
  deckId,
  copyOf,
  visibility: initialVisibility,
  defaultName,
  acceptedCount,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  deckId: string | null;
  /** Si es el mazo de otro: se guarda una copia. */
  copyOf: { username: string | null; name: string } | null;
  visibility: DeckVisibility;
  defaultName: string;
  acceptedCount: number;
  busy: boolean;
  onSave: (opts: {
    name: string;
    asNew: boolean;
    includeAccepted: boolean;
    visibility: DeckVisibility;
  }) => void;
}) {
  const t = useT();
  const lp = useLocalePath();
  /** Tras crear la cuenta o entrar: de vuelta al mazo (sigue en el navegador) y a guardarlo. */
  const afterAccount = encodeURIComponent(lp("/analyze?analyze=1&save=1"));
  const [name, setName] = useState(defaultName);
  const [includeAccepted, setIncludeAccepted] = useState(true);
  const [visibility, setVisibility] = useState(initialVisibility);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    setName(defaultName);
    setVisibility(initialVisibility);
  }, [open, defaultName, initialVisibility]);

  if (!loggedIn) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={t("Guardar mazo", "Save deck")}
        width={380}
        footer={
          <>
            <Link className="btn btn-primary" href={`/signup?next=${afterAccount}`}>
              {t("Crear cuenta", "Create account")}
            </Link>
            <Link className="btn" href={`/login?next=${afterAccount}`}>
              {t("Entrar", "Sign in")}
            </Link>
          </>
        }
      >
        <p>
          {t(
            "Para guardar mazos necesitas una cuenta (gratis). Al crearla vuelves aquí para guardarlo.",
            "You need a (free) account to save decks. Once you create it, you'll come back here to save it.",
          )}
        </p>
        <p className="muted text-[13px]">
          {t(
            "Tu lista, los candados y los descartes se quedan en este navegador: al volver los encontrarás tal cual. Los mazos guardados además descuentan sus cartas al analizar otros.",
            "Your list, locks and dismissals stay in this browser: you'll find them as they are when you come back. Saved decks also count their cards as in use when analyzing others.",
          )}
        </p>
      </Dialog>
    );
  }

  const submit = (asNew: boolean) =>
    onSave({ name: name.trim(), asNew, includeAccepted, visibility });
  // Un mazo mío ya guardado se guarda solo: aquí solo se crea otro a partir de él.
  const asNewOnly = deckId !== null && !copyOf;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        copyOf
          ? t("Guardar una copia", "Save a copy")
          : asNewOnly
            ? t("Guardar como nuevo mazo", "Save as a new deck")
            : t("Guardar mazo", "Save deck")
      }
      width={380}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancelar", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => submit(asNewOnly)}
          >
            {busy
              ? t("Guardando…", "Saving…")
              : asNewOnly
                ? t("Guardar como nuevo", "Save as new")
                : t("Guardar", "Save")}
          </button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(asNewOnly);
        }}
      >
        <div className="field">
          <label className="label" htmlFor="deck-name">
            {t("Nombre", "Name")}
          </label>
          <input
            id="deck-name"
            className="input"
            value={name}
            maxLength={120}
            placeholder={t(
              "Por defecto, el nombre del comandante",
              "Defaults to the commander's name",
            )}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {asNewOnly && (
          <p className="muted text-[13px]">
            {t(
              "Los cambios de este mazo ya se guardan solos. Esto crea otro mazo a partir de él.",
              "This deck's changes already save themselves. This creates another deck from it.",
            )}
          </p>
        )}
        {copyOf && (
          <p className="muted text-[13px]">
            {t(
              `Es el mazo de ${copyOf.username ? `@${copyOf.username}` : copyOf.name}: se guardará una copia en tus mazos, con tu nombre.`,
              `It's ${copyOf.username ? `@${copyOf.username}` : copyOf.name}'s deck: a copy will be saved in your decks, under your name.`,
            )}
          </p>
        )}
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        {acceptedCount > 0 && (
          <label className="check muted">
            <input
              type="checkbox"
              checked={includeAccepted}
              onChange={(e) => setIncludeAccepted(e.target.checked)}
            />
            {acceptedCount === 1
              ? t("Incluir el cambio aceptado", "Include the accepted change")
              : t(
                  `Incluir los ${acceptedCount} cambios aceptados`,
                  `Include the ${acceptedCount} accepted changes`,
                )}
          </label>
        )}
      </form>
    </Dialog>
  );
}

/** Exportar la lista (con los cambios aceptados) o solo los cambios. */
const formats = (t: T): Record<ExportFormat, { label: string; hint: string; file: string }> => ({
  text: {
    label: t("Texto", "Text"),
    hint: t(
      "Una carta por línea; lo leen casi todas las webs y apps de mazos.",
      "One card per line; almost every deck site and app reads it.",
    ),
    file: t("mazo.txt", "deck.txt"),
  },
  arena: {
    label: "MTG Arena",
    hint: t(
      "En Arena: Mazos › Importar (copia y pulsa Importar). Solo entran las cartas que existen en Arena.",
      "In Arena: Decks › Import (copy and press Import). Only cards that exist in Arena are included.",
    ),
    file: t("mazo-arena.txt", "deck-arena.txt"),
  },
  mtgo: {
    label: "MTGO",
    hint: t(
      "Para Magic Online: el comandante va en el banquillo.",
      "For Magic Online: the commander goes in the sideboard.",
    ),
    file: t("mazo-mtgo.txt", "deck-mtgo.txt"),
  },
  moxfield: {
    label: t("Texto con etiquetas", "Text with tags"),
    hint: t(
      "Texto con el rol de cada carta y tus etiquetas (#Ramp, #wincon); al volver a importarlo aquí se leen igual.",
      "Text with each card's role and your tags (#Ramp, #wincon); importing it here again reads them back.",
    ),
    file: t("mazo-etiquetas.txt", "deck-tags.txt"),
  },
});

export function ExportDialog({
  open,
  onClose,
  deck,
  changes,
}: {
  open: boolean;
  onClose: () => void;
  /** El mazo con los cambios aceptados. */
  deck: ExportableDeck;
  changes: string;
}) {
  const t = useT();
  const FORMAT = formats(t);
  const [mode, setMode] = useState<"full" | "changes">("full");
  const [format, setFormat] = useState<ExportFormat>("text");
  const [copied, setCopied] = useState(false);
  const text = mode === "full" ? exportDeck(deck, format) : changes;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "full" ? FORMAT[format].file : t("cambios.txt", "changes.txt");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Exportar", "Export")}
      width={460}
      headerExtra={
        <div className="btn-group" role="group" aria-label={t("Qué exportar", "What to export")}>
          <button
            type="button"
            className={`btn btn-sm ${mode === "full" ? "is-on" : ""}`}
            aria-pressed={mode === "full"}
            onClick={() => setMode("full")}
          >
            {t("Lista completa", "Full list")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === "changes" ? "is-on" : ""}`}
            aria-pressed={mode === "changes"}
            onClick={() => setMode("changes")}
          >
            {t("Solo cambios", "Changes only")}
          </button>
        </div>
      }
      footer={
        <>
          {copied && <span className="pill pill-in mr-auto">{t("Copiado", "Copied")}</span>}
          <button type="button" className="btn" onClick={download}>
            {t("Descargar .txt", "Download .txt")}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void copy()}>
            {t("Copiar", "Copy")}
          </button>
        </>
      }
    >
      {mode === "full" && (
        <div className="chips" role="radiogroup" aria-label={t("Formato", "Format")}>
          {(Object.keys(FORMAT) as ExportFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              className={`chipbtn ${format === f ? "is-on" : ""}`}
              onClick={() => setFormat(f)}
            >
              {FORMAT[f].label}
            </button>
          ))}
        </div>
      )}
      <p className="subtle text-[12.5px]">
        {mode === "full"
          ? `${FORMAT[format].hint} ${t("Incluye los cambios aceptados.", "Includes the accepted changes.")}`
          : t("Los cambios aceptados: − sale, + entra.", "The accepted changes: − out, + in.")}
      </p>
      <textarea
        className="textarea"
        readOnly
        value={text || t("(ningún cambio aceptado)", "(no accepted changes)")}
        style={{ minHeight: 220 }}
        aria-label={t("Texto para exportar", "Text to export")}
      />
    </Dialog>
  );
}

/**
 * Ajustes de un mazo mío guardado, desde su propia página: nombre, visibilidad, duplicar,
 * reemplazar la lista y borrar (antes solo estaban en «Mis mazos»).
 */
export function DeckSettingsDialog({
  open,
  onClose,
  name,
  visibility,
  busy,
  onRename,
  onVisibility,
  onDuplicate,
  onReplaceList,
  onDelete,
  deckId,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  visibility: DeckVisibility;
  busy: boolean;
  onRename: (name: string) => void;
  onVisibility: (v: DeckVisibility) => void;
  onDuplicate: () => void;
  onReplaceList: () => void;
  onDelete: () => void;
  /** Para el historial de versiones. */
  deckId: string;
  onRestored: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar el formulario al abrir
    setDraft(name);
    setConfirming(false);
  }, [open, name]);
  const renamed = draft.trim() !== "" && draft.trim() !== name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Ajustes del mazo", "Deck settings")}
      width={420}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          {t("Cerrar", "Close")}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            if (renamed) onRename(draft.trim());
          }}
        >
          <label className="label" htmlFor="deck-settings-name">
            {t("Nombre", "Name")}
          </label>
          <div className="flex gap-2">
            <input
              id="deck-settings-name"
              className="input"
              value={draft}
              maxLength={120}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn" disabled={busy || !renamed}>
              {t("Cambiar", "Rename")}
            </button>
          </div>
        </form>

        <VisibilityPicker
          value={visibility}
          onChange={(v) => v !== visibility && onVisibility(v)}
        />

        <div className="field">
          <span className="label">{t("Lista", "List")}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={onDuplicate}>
              {t("Duplicar mazo", "Duplicate deck")}
            </button>
            <button type="button" className="btn" onClick={onReplaceList}>
              {t("Reemplazar la lista", "Replace the list")}
            </button>
          </div>
          <span className="hint">
            {t(
              "Para quitar o añadir cartas sueltas, usa la pestaña Lista. Los cambios se guardan solos.",
              "To add or remove single cards, use the List tab. Changes save themselves.",
            )}
          </span>
        </div>

        <DeckHistory deckId={deckId} open={open} onRestored={onRestored} />

        <div className="field border-t border-line pt-3">
          {confirming ? (
            <div className="flex flex-col gap-2">
              <span className="text-[13px]">
                {t(
                  `¿Borrar «${name}»? Sus cartas dejarán de contar como en uso. No se puede deshacer.`,
                  `Delete “${name}”? Its cards will no longer count as in use. This can't be undone.`,
                )}
              </span>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={() => setConfirming(false)}>
                  {t("Cancelar", "Cancel")}
                </button>
                <button type="button" className="btn btn-out" disabled={busy} onClick={onDelete}>
                  {t(`Borrar «${name}»`, `Delete “${name}”`)}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-out self-start"
              onClick={() => setConfirming(true)}
            >
              {t("Borrar mazo", "Delete deck")}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const fmtWhen = (iso: string, intl: string) =>
  new Date(iso).toLocaleString(intl, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Sol Ring, Island ×2 y 3 más". */
const cardsLine = (rows: { name: string; copies: number }[], t: T) => {
  const shown = rows.slice(0, 3).map((r) => (r.copies > 1 ? `${r.name} ×${r.copies}` : r.name));
  return rows.length > 3
    ? t(
        `${shown.join(", ")} y ${rows.length - 3} más`,
        `${shown.join(", ")} and ${rows.length - 3} more`,
      )
    : shown.join(", ");
};

/**
 * Historial del mazo: las versiones anteriores de la lista, con lo que cambió después de cada una,
 * y «Restaurar» (la de ahora pasa a su vez al historial, así que se puede deshacer).
 */
function DeckHistory({
  deckId,
  open,
  onRestored,
}: {
  deckId: string;
  open: boolean;
  onRestored: () => void;
}) {
  const t = useT();
  const intl = useIntlLocale();
  const [shown, setShown] = useState(false);
  const [versions, setVersions] = useState<DeckVersionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- al cerrar, se vuelve a pedir al abrir
      setShown(false);
      setVersions(null);
    }
  }, [open]);

  async function load() {
    setShown(true);
    setError(null);
    try {
      setVersions(await api<DeckVersionDTO[]>(`/api/decks/${encodeURIComponent(deckId)}/versions`));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo cargar el historial", "Couldn't load the history"),
      );
    }
  }

  async function restore(v: DeckVersionDTO) {
    setRestoring(v.id);
    setError(null);
    try {
      await api(`/api/decks/${encodeURIComponent(deckId)}/versions/${v.id}`, { method: "POST" });
      onRestored();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : t("No se pudo restaurar", "Couldn't restore it"),
      );
      setRestoring(null);
    }
  }

  return (
    <div className="field">
      <span className="label">{t("Historial", "History")}</span>
      {!shown ? (
        <button type="button" className="btn self-start" onClick={() => void load()}>
          {t("Ver versiones anteriores", "See previous versions")}
        </button>
      ) : versions === null && !error ? (
        <Loading>{t("Cargando el historial…", "Loading the history…")}</Loading>
      ) : versions?.length === 0 ? (
        <span className="hint">
          {t(
            "Aún no hay versiones anteriores: se guarda una cada vez que cambia la lista.",
            "No previous versions yet: one is saved every time the list changes.",
          )}
        </span>
      ) : (
        <ul
          className="flex flex-col gap-2"
          aria-label={t("Versiones anteriores", "Previous versions")}
        >
          {(versions ?? []).map((v) => (
            <li key={v.id} className="flex items-start gap-2 text-[13px]">
              <span className="flex min-w-0 flex-1 flex-col">
                <b>
                  {fmtWhen(v.createdAt, intl)} · {v.cardCount} {t("cartas", "cards")}
                </b>
                {v.added.length + v.removed.length > 0 && (
                  <span className="subtle text-xs">
                    {t("Después", "Afterwards")}
                    {v.removed.length > 0 && (
                      <>
                        {" "}
                        {t("salieron", "out:")} {cardsLine(v.removed, t)}
                      </>
                    )}
                    {v.removed.length > 0 && v.added.length > 0 && t(" y", ";")}
                    {v.added.length > 0 && (
                      <>
                        {" "}
                        {t("entraron", "in:")} {cardsLine(v.added, t)}
                      </>
                    )}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={restoring !== null}
                onClick={() => void restore(v)}
              >
                {restoring === v.id ? t("Restaurando…", "Restoring…") : t("Restaurar", "Restore")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <Banner tone="out">{error}</Banner>}
    </div>
  );
}
