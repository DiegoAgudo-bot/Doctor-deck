"use client";

import { useEffect, useState } from "react";
import { CARD_NOTE_MAX, DECK_DESCRIPTION_MAX } from "@/domain/deck/notes";
import type { CardDTO, DeckComparisonDTO, DeckVersionDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { IconPencil } from "./icons";
import { ManaCost } from "./mana";
import { Banner, Dialog, Loading } from "./ui";
import { useIntlLocale, useT } from "@/components/i18n";

const patchDeck = (deckId: string, body: unknown) =>
  api(`/api/decks/${encodeURIComponent(deckId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/**
 * Descripción pública del mazo (de qué va, cómo se juega). Quien lo mira la lee; su dueño la
 * escribe o cambia aquí mismo.
 */
export function DeckDescription({
  deckId,
  text,
  editable,
  onSaved,
}: {
  deckId: string;
  text: string;
  editable: boolean;
  onSaved: (text: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editable && !text) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await patchDeck(deckId, { description: draft });
      onSaved(draft.trim());
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo guardar la descripción", "Couldn't save the description"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="label" htmlFor="deck-description">
          {t("Descripción", "Description")}
        </label>
        <textarea
          id="deck-description"
          className="textarea"
          style={{ minHeight: 110 }}
          maxLength={DECK_DESCRIPTION_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-describedby="deck-description-hint"
        />
        <span className="hint" id="deck-description-hint">
          {t(
            "De qué va el mazo y cómo se juega. La ve cualquiera que pueda abrirlo.",
            "What the deck is about and how it plays. Anyone who can open it sees it.",
          )}{" "}
          {draft.length}/{DECK_DESCRIPTION_MAX}
        </span>
        {error && <Banner tone="out">{error}</Banner>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t("Guardando…", "Saving…") : t("Guardar descripción", "Save description")}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            {t("Cancelar", "Cancel")}
          </button>
        </div>
      </form>
    );
  }

  const edit = () => {
    setDraft(text);
    setEditing(true);
  };
  if (!text) {
    return (
      <button type="button" className="btn btn-ghost self-start" onClick={edit}>
        <IconPencil size={14} />
        {t("Añadir una descripción", "Add a description")}
      </button>
    );
  }
  return (
    <section className="deckdesc" aria-label={t("Descripción", "Description")}>
      <p>{text}</p>
      {editable && (
        <button type="button" className="linkbtn text-[13px]" onClick={edit}>
          {t("Editar la descripción", "Edit the description")}
        </button>
      )}
    </section>
  );
}

/** Nota privada de una carta del mazo (por qué está, qué combo cierra…). */
export function CardNoteDialog({
  deckId,
  card,
  text,
  onClose,
  onSaved,
}: {
  deckId: string;
  card: CardDTO | null;
  text: string;
  onClose: () => void;
  onSaved: (oracleId: string, text: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reiniciar al abrir otra carta
    setDraft(text);
    setError(null);
  }, [card, text]);

  async function save(value: string) {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      await patchDeck(deckId, { cardNote: { oracleId: card.oracleId, text: value } });
      onSaved(card.oracleId, value.trim());
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : t("No se pudo guardar la nota", "Couldn't save the note"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title={card ? t(`Nota de ${card.name}`, `Note on ${card.name}`) : ""}
      width={440}
      footer={
        <>
          {text && (
            <button
              type="button"
              className="btn btn-out"
              disabled={busy}
              onClick={() => void save("")}
            >
              {t("Quitar la nota", "Remove note")}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t("Cancelar", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || draft.trim() === text}
            onClick={() => void save(draft)}
          >
            {t("Guardar nota", "Save note")}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label" htmlFor="card-note">
          {t("Nota", "Note")}
        </label>
        <textarea
          id="card-note"
          className="textarea"
          style={{ minHeight: 90 }}
          maxLength={CARD_NOTE_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-describedby="card-note-hint"
        />
        <span className="hint" id="card-note-hint">
          {t(
            "Solo la ves tú: por qué está en el mazo, qué combo cierra, por cuál la cambiarías…",
            "Only you see it: why it's in the deck, which combo it finishes, what you'd swap it for…",
          )}
        </span>
        {error && <Banner tone="out">{error}</Banner>}
      </div>
    </Dialog>
  );
}

const fmtWhen = (iso: string, intl: string) =>
  new Date(iso).toLocaleString(intl, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function CompareColumn({
  title,
  rows,
  empty,
  tone,
}: {
  title: string;
  rows: DeckComparisonDTO["onlyMine"];
  empty: string;
  tone: "in" | "out";
}) {
  const copies = rows.reduce((n, r) => n + r.copies, 0);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <b className="text-[13px]">
        {title} <span className="mono subtle">{copies}</span>
      </b>
      {rows.length === 0 ? (
        <span className="hint">{empty}</span>
      ) : (
        <ul className="comparelist">
          {rows.map((r) => (
            <li key={r.card.oracleId}>
              <span className={`mono ${tone === "in" ? "text-in" : "text-out"}`}>
                {tone === "in" ? "+" : "−"}
                {r.copies}
              </span>
              <CardHover card={r.card} className="min-w-0 flex-1 truncate">
                {r.card.name}
              </CardHover>
              <ManaCost cost={r.card.manaCost} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Comparar mi mazo con el mazo medio de la comunidad o con una versión anterior: lo que solo
 * lleva el mío y lo que solo lleva lo otro (sin tierras básicas).
 */
export function DeckCompareDialog({
  deckId,
  open,
  onClose,
}: {
  deckId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const intl = useIntlLocale();
  const [against, setAgainst] = useState("average");
  const [versions, setVersions] = useState<DeckVersionDTO[]>([]);
  const [result, setResult] = useState<DeckComparisonDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<DeckVersionDTO[]>(`/api/decks/${encodeURIComponent(deckId)}/versions`, undefined, {
      silent: true,
    })
      .then((v) => alive && setVersions(v))
      .catch(() => {
        /* sin historial: queda el mazo medio */
      });
    return () => {
      alive = false;
    };
  }, [open, deckId]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se vuelve a pedir al cambiar con qué
    setResult(null);
    setError(null);
    api<DeckComparisonDTO>(
      `/api/decks/${encodeURIComponent(deckId)}/compare?with=${encodeURIComponent(against)}`,
    )
      .then((r) => alive && setResult(r))
      .catch(
        (e: unknown) =>
          alive &&
          setError(
            e instanceof ApiError ? e.message : t("No se pudo comparar", "Couldn't compare"),
          ),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma
  }, [open, deckId, against]);

  const average = against === "average";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Comparar el mazo", "Compare the deck")}
      width={640}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          {t("Cerrar", "Close")}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="field">
          <label className="label" htmlFor="compare-with">
            {t("Comparar con", "Compare with")}
          </label>
          <select
            id="compare-with"
            className="select"
            value={against}
            onChange={(e) => setAgainst(e.target.value)}
          >
            <option value="average">
              {t("El mazo medio de la comunidad", "The community's average deck")}
            </option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {t("Versión del", "Version from")} {fmtWhen(v.createdAt, intl)} · {v.cardCount}{" "}
                {t("cartas", "cards")}
              </option>
            ))}
          </select>
        </div>
        {error && <Banner tone="out">{error}</Banner>}
        {!result && !error && <Loading>{t("Comparando…", "Comparing…")}</Loading>}
        {result && (
          <>
            {result.warning && <Banner tone="warn">{result.warning}</Banner>}
            <p className="muted text-[13px]">
              {result.onlyMine.length + result.onlyOther.length === 0
                ? t(
                    "Son iguales (sin contar tierras básicas).",
                    "They're the same (basic lands aside).",
                  )
                : t(
                    `Coinciden ${result.shared} cartas, sin contar tierras básicas.`,
                    `${result.shared} cards match, basic lands aside.`,
                  )}
            </p>
            <div
              className="grid-1-sm grid gap-4"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              <CompareColumn
                tone="in"
                title={t("Solo en tu mazo", "Only in your deck")}
                rows={result.onlyMine}
                empty={t(
                  "Nada: lo otro lleva todo lo tuyo.",
                  "Nothing: the other has all of yours.",
                )}
              />
              <CompareColumn
                tone="out"
                title={
                  average
                    ? t("Solo en el mazo medio", "Only in the average deck")
                    : t("Solo en esa versión", "Only in that version")
                }
                rows={result.onlyOther}
                empty={t("Nada: tu mazo lleva todo lo otro.", "Nothing: your deck has all of it.")}
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
