/** Descripción pública de un mazo y notas privadas por carta (solo las ve su dueño). */
export const DECK_DESCRIPTION_MAX = 2000;
export const CARD_NOTE_MAX = 300;
/** Como mucho, una nota por cada carta de un mazo grande. */
export const CARD_NOTES_MAX = 150;

const tidy = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** La descripción limpia (saltos de línea normalizados, sin espacios sobrantes) y con tope. */
export const cleanDescription = (text: string) => tidy(text).slice(0, DECK_DESCRIPTION_MAX);

/** Una nota de carta: una sola línea, con tope. */
export const cleanCardNote = (text: string) =>
  tidy(text)
    .replace(/\s*\n\s*/g, " ")
    .slice(0, CARD_NOTE_MAX);

/** Las notas guardadas (JSON `{oracleId: texto}`); lo que no tenga esa forma se ignora. */
export function parseCardNotes(json: string): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const notes: Record<string, string> = {};
    for (const [id, text] of Object.entries(raw)) {
      if (typeof text === "string" && text) notes[id] = text;
    }
    return notes;
  } catch {
    return {};
  }
}

/** Pone (o, con texto vacío, quita) la nota de una carta. null si ya hay demasiadas notas. */
export function withCardNote(
  notes: Readonly<Record<string, string>>,
  oracleId: string,
  text: string,
): Record<string, string> | null {
  const next = { ...notes };
  const clean = cleanCardNote(text);
  if (clean) next[oracleId] = clean;
  else delete next[oracleId];
  return Object.keys(next).length > CARD_NOTES_MAX ? null : next;
}
