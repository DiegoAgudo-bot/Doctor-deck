import type { Card } from "../cards/types";
import type { CardUsage } from "../suggestions/engine";

/**
 * Qué parte de un mazo tengo en la colección:
 * - `owned`: tengo copias libres suficientes.
 * - `in_other_decks`: tengo las copias, pero (algunas) están en otros de mis mazos guardados.
 * - `missing`: me faltan copias (hay que comprarlas).
 * - `basic`: tierra básica (no se lleva en la colección; no cuenta).
 */
export type OwnershipStatus = "owned" | "in_other_decks" | "missing" | "basic";

export interface CardOwnership {
  card: Card;
  isCommander: boolean;
  /** Copias que pide el mazo. */
  needed: number;
  /** Copias que tengo en total. */
  owned: number;
  /** Copias libres (las que no usan mis otros mazos). */
  available: number;
  /** Mis otros mazos que la usan. */
  usedIn: string[];
  /** Copias que tendría que sacar de otros mazos (las tengo, pero están ocupadas). */
  fromOtherDecks: number;
  /** Copias que tendría que comprar. */
  toBuy: number;
  status: OwnershipStatus;
}

export interface OwnershipTotals {
  /** Copias del mazo sin contar básicas. */
  cards: number;
  /** Copias que ya tengo libres. */
  have: number;
  fromOtherDecks: number;
  toBuy: number;
}

/** Cuánto del mazo (comandantes + 99) tengo, carta a carta, descontando lo que usan otros mazos. */
export function deckOwnership(
  commanders: readonly Card[],
  cards: readonly { card: Card; quantity: number }[],
  owned: ReadonlyMap<string, number>,
  usage?: ReadonlyMap<string, CardUsage>,
): { items: CardOwnership[]; totals: OwnershipTotals } {
  const entries = [
    ...commanders.map((card) => ({ card, quantity: 1, isCommander: true })),
    ...cards.map((c) => ({ ...c, isCommander: false })),
  ];
  const items = entries.map(({ card, quantity, isCommander }): CardOwnership => {
    const have = owned.get(card.oracleId) ?? 0;
    const used = usage?.get(card.oracleId);
    const available = Math.max(0, have - (used?.quantity ?? 0));
    const fromFree = Math.min(quantity, available);
    const fromOtherDecks = Math.min(quantity, have) - fromFree;
    const toBuy = Math.max(0, quantity - have);
    const status: OwnershipStatus = card.isBasicLand
      ? "basic"
      : toBuy > 0
        ? "missing"
        : fromOtherDecks > 0
          ? "in_other_decks"
          : "owned";
    return {
      card,
      isCommander,
      needed: quantity,
      owned: have,
      available,
      usedIn: used?.decks ?? [],
      fromOtherDecks: card.isBasicLand ? 0 : fromOtherDecks,
      toBuy: card.isBasicLand ? 0 : toBuy,
      status,
    };
  });
  const counted = items.filter((i) => i.status !== "basic");
  return {
    items,
    totals: {
      cards: counted.reduce((n, i) => n + i.needed, 0),
      have: counted.reduce((n, i) => n + Math.min(i.needed, i.available), 0),
      fromOtherDecks: counted.reduce((n, i) => n + i.fromOtherDecks, 0),
      toBuy: counted.reduce((n, i) => n + i.toBuy, 0),
    },
  };
}

/**
 * Los mismos totales que `deckOwnership`, sin cartas completas: basta con oracleId, copias y si es
 * básica (para resumir muchos mazos a la vez, p. ej. en Comunidad).
 */
export function ownershipTotals(
  entries: readonly { oracleId: string; quantity: number; isBasicLand: boolean }[],
  owned: ReadonlyMap<string, number>,
  usage?: ReadonlyMap<string, CardUsage>,
): OwnershipTotals & { missing: { oracleId: string; toBuy: number }[] } {
  const totals = { cards: 0, have: 0, fromOtherDecks: 0, toBuy: 0 };
  const missing: { oracleId: string; toBuy: number }[] = [];
  for (const { oracleId, quantity, isBasicLand } of entries) {
    if (isBasicLand) continue;
    const have = owned.get(oracleId) ?? 0;
    const available = Math.max(0, have - (usage?.get(oracleId)?.quantity ?? 0));
    const fromFree = Math.min(quantity, available);
    const toBuy = Math.max(0, quantity - have);
    totals.cards += quantity;
    totals.have += fromFree;
    totals.fromOtherDecks += Math.min(quantity, have) - fromFree;
    totals.toBuy += toBuy;
    if (toBuy > 0) missing.push({ oracleId, toBuy });
  }
  return { ...totals, missing };
}
