import { ownershipTotals } from "../deck/ownership";
import type { CardUsage } from "../suggestions/engine";

/** Un mazo público candidato, con sus cartas (comandantes incluidos) por oracleId. */
export interface CommunityCandidate {
  id: string;
  createdAt: Date;
  likes: number;
  cards: readonly { oracleId: string; quantity: number }[];
}

export interface DeckOwnershipSummary {
  /** Copias del mazo sin básicas. */
  cards: number;
  /** Copias que ya tengo libres. */
  have: number;
  fromOtherDecks: number;
  toBuy: number;
  /** % del mazo que tengo libre (como en "Qué me falta"), 0–100. */
  percent: number;
  /** Coste aproximado de lo que falta (EUR) y cuántas cartas no tienen precio. */
  cost: number;
  unpriced: number;
}

export type CommunitySort = "recent" | "likes" | "owned";

/** Cuánto de cada mazo tengo y cuánto cuesta lo que falta. */
export function summarizeOwnership(
  deck: CommunityCandidate,
  ctx: {
    owned: ReadonlyMap<string, number>;
    usage?: ReadonlyMap<string, CardUsage> | undefined;
    basics: ReadonlySet<string>;
    prices: ReadonlyMap<string, number>;
  },
): DeckOwnershipSummary {
  const t = ownershipTotals(
    deck.cards.map((c) => ({ ...c, isBasicLand: ctx.basics.has(c.oracleId) })),
    ctx.owned,
    ctx.usage,
  );
  let cost = 0;
  let unpriced = 0;
  for (const m of t.missing) {
    const price = ctx.prices.get(m.oracleId);
    if (price === undefined) unpriced += 1;
    else cost += price * m.toBuy;
  }
  return {
    cards: t.cards,
    have: t.have,
    fromOtherDecks: t.fromOtherDecks,
    toBuy: t.toBuy,
    percent: t.cards ? Math.round((t.have / t.cards) * 100) : 0,
    cost: Math.round(cost * 100) / 100,
    unpriced,
  };
}

/**
 * Ordena: `recent` (más nuevos), `likes` (más gustados; empate, más nuevos) u `owned` (los que más
 * tengo; empate, lo que falta más barato).
 */
export function sortCommunity<D extends CommunityCandidate>(
  decks: readonly { deck: D; ownership: DeckOwnershipSummary }[],
  sort: CommunitySort,
) {
  const newer = (a: D, b: D) => b.createdAt.getTime() - a.createdAt.getTime();
  return [...decks].sort((a, b) =>
    sort === "likes"
      ? b.deck.likes - a.deck.likes || newer(a.deck, b.deck)
      : sort === "owned"
        ? b.ownership.percent - a.ownership.percent ||
          a.ownership.cost - b.ownership.cost ||
          newer(a.deck, b.deck)
        : newer(a.deck, b.deck),
  );
}
