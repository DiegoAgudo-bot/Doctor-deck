import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card } from "../cards/types";
import { changeCard, exportDecklist, type ExportableDeck } from "./export";
import type { ResolvedDeck } from "./resolve";

/** Por qué no se puede añadir una carta a un mazo (desde la colección, la ficha…). */
export type AddCardProblem = "is_commander" | "off_color" | "already_in_deck";
/** Por qué no se puede cambiar una carta (añadir o quitar copias) de un mazo. */
export type CardChangeProblem = AddCardProblem | "not_in_deck";

export const ADD_CARD_MESSAGES: Record<CardChangeProblem, (card: string) => string> = {
  is_commander: (card) => `${card} es el comandante de este mazo.`,
  off_color: (card) => `${card} está fuera de la identidad de color del comandante.`,
  already_in_deck: (card) =>
    `${card} ya está en el mazo (en Commander solo puede haber una copia).`,
  not_in_deck: (card) => `${card} no está en el mazo.`,
};

/** Copias que se añaden (`delta` > 0) o se quitan (< 0) de una carta. */
export interface DeckCardChange {
  card: Card;
  delta: number;
}

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
 * null si se pueden hacer todos los cambios a la vez (primero se quitan copias y luego se añaden,
 * como al aplicar un cambio «quita X → mete Y»); si no, el primero que falla y por qué.
 */
export function cardChangesProblem(
  deck: ResolvedDeck,
  changes: readonly DeckCardChange[],
): { problem: CardChangeProblem; card: Card } | null {
  const identity = combinedColorIdentity(deck.commanders);
  const qty = new Map(deck.cards.map((c) => [c.card.oracleId, c.quantity]));
  const isCommander = (card: Card) => deck.commanders.some((c) => c.oracleId === card.oracleId);
  for (const { card, delta } of changes.filter((c) => c.delta < 0)) {
    if (isCommander(card)) return { problem: "is_commander", card };
    const have = qty.get(card.oracleId) ?? 0;
    if (have < -delta) return { problem: "not_in_deck", card };
    qty.set(card.oracleId, have + delta);
  }
  for (const { card, delta } of changes.filter((c) => c.delta > 0)) {
    if (isCommander(card)) return { problem: "is_commander", card };
    if (!fitsColorIdentity(card, identity)) return { problem: "off_color", card };
    const next = (qty.get(card.oracleId) ?? 0) + delta;
    if (!card.isBasicLand && next > 1) return { problem: "already_in_deck", card };
    qty.set(card.oracleId, next);
  }
  return null;
}

/**
 * La lista en texto con los cambios hechos. Las líneas que no se encontraron en el catálogo se
 * conservan al final, para no perderlas al reescribir la lista (p. ej. si venía de un enlace).
 */
export function decklistWithChanges(
  deck: ResolvedDeck,
  changes: readonly DeckCardChange[],
): string {
  let exportable = exportableFromResolved(deck);
  for (const { card, delta } of changes) {
    exportable = changeCard(exportable, { oracleId: card.oracleId, name: card.name }, delta);
  }
  const text = exportDecklist(exportable);
  const lost = deck.unresolved.map((e) => `${e.quantity} ${e.name}`);
  return lost.length > 0 ? `${text}${lost.join("\n")}\n` : text;
}

/** La lista en texto con una copia más de `card`. */
export function decklistWithCard(deck: ResolvedDeck, card: Card): string {
  return decklistWithChanges(deck, [{ card, delta: 1 }]);
}
