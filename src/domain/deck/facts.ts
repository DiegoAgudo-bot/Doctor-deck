import { COLORS, type Card } from "../cards/types";
import { estimateBracket } from "./bracket";

/** Lo que se guarda de cada mazo para filtrar en Comunidad sin cargar sus cartas. */
export interface DeckFacts {
  /** Identidad de color de los comandantes en orden WUBRG ("" = incolora). */
  colorIdentity: string;
  /** Bracket mínimo estimado (2–4). */
  bracket: number;
}

export function deckFacts(
  commanders: readonly Card[],
  cards: readonly { card: Card; quantity: number }[],
): DeckFacts {
  const identity = new Set(commanders.flatMap((c) => c.colorIdentity));
  return {
    colorIdentity: COLORS.filter((c) => identity.has(c)).join(""),
    // El número no depende de los roles (los tutores solo se listan).
    bracket: estimateBracket(
      [...commanders, ...cards.map((c) => c.card)].map((card) => ({ card, roles: [] })),
    ).bracket,
  };
}

/** "wr", "RW"… → "WR" (orden WUBRG, sin repetir, solo letras válidas). */
export const normalizeIdentity = (letters: string): string =>
  COLORS.filter((c) => letters.toUpperCase().includes(c)).join("");
