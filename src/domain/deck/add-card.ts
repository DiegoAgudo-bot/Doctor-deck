import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card } from "../cards/types";
import { changeCard, exportDecklist, type ExportableDeck } from "./export";
import type { ResolvedDeck } from "./resolve";

/** Por qué no se puede añadir una carta a un mazo (desde la colección, la ficha…). */
export type AddCardProblem = "is_commander" | "off_color" | "already_in_deck";

export const ADD_CARD_MESSAGES: Record<AddCardProblem, (card: string) => string> = {
  is_commander: (card) => `${card} ya es el comandante de este mazo.`,
  off_color: (card) => `${card} está fuera de la identidad de color del comandante.`,
  already_in_deck: (card) =>
    `${card} ya está en el mazo (en Commander solo puede haber una copia).`,
};

/** null si se puede añadir; si no, el motivo. Las tierras básicas se pueden repetir. */
export function addCardProblem(deck: ResolvedDeck, card: Card): AddCardProblem | null {
  if (deck.commanders.some((c) => c.oracleId === card.oracleId)) return "is_commander";
  if (!fitsColorIdentity(card, combinedColorIdentity(deck.commanders))) return "off_color";
  if (!card.isBasicLand && deck.cards.some((c) => c.card.oracleId === card.oracleId)) {
    return "already_in_deck";
  }
  return null;
}

/** El mazo resuelto en la forma que entiende `exportDecklist`, con la impresión de cada carta. */
export function exportableFromResolved(deck: ResolvedDeck): ExportableDeck {
  const printing = (oracleId: string) => {
    const p = deck.printings?.get(oracleId);
    return p ? { printing: { setCode: p.setCode, collectorNumber: p.collectorNumber } } : {};
  };
  return {
    commanders: deck.commanders.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      layout: c.layout,
      ...printing(c.oracleId),
    })),
    cards: deck.cards.map((c) => ({
      oracleId: c.card.oracleId,
      name: c.card.name,
      layout: c.card.layout,
      quantity: c.quantity,
      ...printing(c.card.oracleId),
    })),
  };
}

/**
 * La lista en texto con una copia más de `card`. Las líneas que no se encontraron en el catálogo se
 * conservan al final, para no perderlas al reescribir la lista (p. ej. si venía de un enlace).
 */
export function decklistWithCard(deck: ResolvedDeck, card: Card): string {
  const text = exportDecklist(
    changeCard(exportableFromResolved(deck), { oracleId: card.oracleId, name: card.name }, 1),
  );
  const lost = deck.unresolved.map((e) => `${e.quantity} ${e.name}`);
  return lost.length > 0 ? `${text}${lost.join("\n")}\n` : text;
}
