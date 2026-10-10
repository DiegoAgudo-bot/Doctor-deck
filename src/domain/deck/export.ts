/** Forma mínima de un mazo para exportarlo (la usan también los componentes de cliente). */
export interface ExportableDeck {
  commanders: readonly ExportableCard[];
  cards: readonly (ExportableCard & { quantity: number })[];
}

interface ExportableCard {
  oracleId: string;
  name: string;
  /** `layout` de Scryfall: Arena y MTGO escriben distinto las cartas de varias caras. */
  layout?: string | undefined;
  /** Etiquetas para el formato `moxfield` (`#Ramp`). */
  tags?: readonly string[] | undefined;
}

/** Solo los campos de exportación (a veces llega una CardDTO entera). */
const pick = ({ oracleId, name, layout, tags }: ExportableCard): ExportableCard => ({
  oracleId,
  name,
  ...(layout === undefined ? {} : { layout }),
  ...(tags === undefined ? {} : { tags }),
});

export interface AcceptedSwap {
  outOracleId: string;
  in: ExportableCard;
}

/** Aplica cambios 1×1: quita una copia de la que sale y mete una de la que entra. */
export function applySwaps(deck: ExportableDeck, swaps: readonly AcceptedSwap[]): ExportableDeck {
  const cards = deck.cards.map((c) => ({ ...c }));
  for (const swap of swaps) {
    const out = cards.find((c) => c.oracleId === swap.outOracleId);
    if (!out || out.quantity <= 0) continue;
    out.quantity -= 1;
    const existing = cards.find((c) => c.oracleId === swap.in.oracleId);
    if (existing) existing.quantity += 1;
    else cards.push({ ...pick(swap.in), quantity: 1 });
  }
  return { commanders: deck.commanders, cards: cards.filter((c) => c.quantity > 0) };
}

/**
 * Cambia las copias de una carta en las 99: `delta` positivo añade, negativo quita (si llega a 0,
 * la carta sale del mazo). Los comandantes no se tocan.
 */
export function changeCard(
  deck: ExportableDeck,
  card: ExportableCard,
  delta: number,
): ExportableDeck {
  if (deck.commanders.some((c) => c.oracleId === card.oracleId)) return deck;
  const cards = deck.cards.map((c) => ({ ...c }));
  const existing = cards.find((c) => c.oracleId === card.oracleId);
  if (existing) existing.quantity += delta;
  else if (delta > 0) cards.push({ ...pick(card), quantity: delta });
  return { commanders: deck.commanders, cards: cards.filter((c) => c.quantity > 0) };
}

/** Texto en formato estándar (Moxfield/Archidekt/Arena lo importan): secciones Commander y Deck. */
export function exportDecklist(deck: ExportableDeck): string {
  const lines = ["Commander", ...deck.commanders.map((c) => `1 ${c.name}`), "", "Deck"];
  const sorted = [...deck.cards].sort((a, b) => a.name.localeCompare(b.name));
  for (const c of sorted) lines.push(`${c.quantity} ${c.name}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Formatos de exportación:
 * - `text`: el estándar (Moxfield, Archidekt, ManaBox…).
 * - `arena`: MTG Arena. Las split se escriben `A /// B`; las de dos caras y aventuras, solo la cara
 *   frontal.
 * - `mtgo`: Magic Online. Sin secciones: las 99 y, tras una línea en blanco, el comandante en el
 *   banquillo. Las split se escriben `A/B`.
 * - `moxfield`: el texto estándar con las etiquetas de cada carta (`1 Sol Ring #Ramp #wincon`).
 */
export const EXPORT_FORMATS = ["text", "arena", "mtgo", "moxfield"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Cartas con dos mitades en la misma cara (en Arena y MTGO conservan las dos mitades). */
const SPLIT_LAYOUTS = new Set(["split"]);

function nameFor(card: ExportableCard, format: ExportFormat): string {
  const [front = card.name, ...rest] = card.name.split(" // ");
  if (format === "text" || format === "moxfield" || rest.length === 0) return card.name;
  if (card.layout !== undefined && SPLIT_LAYOUTS.has(card.layout))
    return [front, ...rest].join(format === "arena" ? " /// " : "/");
  return front;
}

/** " #Ramp #wincon" (sin espacios dentro de cada etiqueta, que cortarían la etiqueta). */
const tagSuffix = (tags: readonly string[] | undefined) =>
  (tags ?? []).map((t) => ` #${t.replace(/\s+/g, "")}`).join("");

export function exportDeck(deck: ExportableDeck, format: ExportFormat): string {
  if (format === "text") return exportDecklist(deck);
  if (format === "moxfield") {
    const lines = ["Commander", ...deck.commanders.map((c) => `1 ${c.name}`), "", "Deck"];
    const sorted = [...deck.cards].sort((a, b) => a.name.localeCompare(b.name));
    for (const c of sorted) lines.push(`${c.quantity} ${c.name}${tagSuffix(c.tags)}`);
    return `${lines.join("\n")}\n`;
  }
  const sorted = [...deck.cards].sort((a, b) => a.name.localeCompare(b.name));
  const main = sorted.map((c) => `${c.quantity} ${nameFor(c, format)}`);
  const commanders = deck.commanders.map((c) => `1 ${nameFor(c, format)}`);
  const lines =
    format === "arena"
      ? ["Commander", ...commanders, "", "Deck", ...main]
      : [...main, "", ...commanders];
  return `${lines.join("\n")}\n`;
}
