import type { CardUsage } from "../suggestions/engine";

/** Una carta de una lista (deseos o para cambiar) con sus copias. */
export interface ListedCard {
  oracleId: string;
  quantity: number;
}

export interface WishlistEntry extends ListedCard {
  /** Copias que he pedido a mano. */
  manual: number;
  /** Copias que me faltan para los mazos que he metido en la lista de deseos. */
  forDecks: number;
}

/**
 * Lista de deseos: lo que he añadido a mano y lo que me falta para los mazos marcados. Lo que me
 * falta de un mazo = lo que piden todos mis mazos menos lo que tengo, como mucho lo que piden los
 * marcados (si sobra para los marcados, no falta nada). Si una carta está por las dos vías, se
 * quiere el máximo, no la suma.
 */
export function buildWishlist(input: {
  manual: readonly ListedCard[];
  /** Copias que piden los mazos marcados (comandantes incluidos). */
  markedDecks: ReadonlyMap<string, number>;
  /** Copias usadas en todos mis mazos guardados. */
  usage: ReadonlyMap<string, CardUsage>;
  owned: ReadonlyMap<string, number>;
  basics: ReadonlySet<string>;
}): WishlistEntry[] {
  const byId = new Map<string, WishlistEntry>();
  for (const [oracleId, marked] of input.markedDecks) {
    if (input.basics.has(oracleId)) continue;
    const all = input.usage.get(oracleId)?.quantity ?? marked;
    const missing = Math.min(marked, Math.max(0, all - (input.owned.get(oracleId) ?? 0)));
    if (missing > 0)
      byId.set(oracleId, { oracleId, quantity: missing, manual: 0, forDecks: missing });
  }
  for (const m of input.manual) {
    if (m.quantity <= 0) continue;
    const e = byId.get(m.oracleId);
    if (e) {
      e.manual = m.quantity;
      e.quantity = Math.max(e.forDecks, m.quantity);
    } else {
      byId.set(m.oracleId, {
        oracleId: m.oracleId,
        quantity: m.quantity,
        manual: m.quantity,
        forDecks: 0,
      });
    }
  }
  return [...byId.values()];
}

/** Para cambiar: mis copias libres (tengo − usadas en mis mazos), sin básicas ni las que guardo. */
export function buildTradelist(input: {
  owned: ReadonlyMap<string, number>;
  usage: ReadonlyMap<string, CardUsage>;
  keep: ReadonlySet<string>;
  basics: ReadonlySet<string>;
}): ListedCard[] {
  const out: ListedCard[] = [];
  for (const [oracleId, have] of input.owned) {
    if (input.basics.has(oracleId) || input.keep.has(oracleId)) continue;
    const free = have - (input.usage.get(oracleId)?.quantity ?? 0);
    if (free > 0) out.push({ oracleId, quantity: free });
  }
  return out;
}

export interface TradeMatch {
  /** Lo que el otro tiene para cambiar y yo quiero. */
  theyHave: ListedCard[];
  /** Lo que el otro quiere y yo tengo para cambiar. */
  theyWant: ListedCard[];
}

const intersect = (wants: readonly ListedCard[], offers: readonly ListedCard[]) => {
  const offered = new Map(offers.map((o) => [o.oracleId, o.quantity]));
  return wants.flatMap((w) => {
    const q = Math.min(w.quantity, offered.get(w.oracleId) ?? 0);
    return q > 0 ? [{ oracleId: w.oracleId, quantity: q }] : [];
  });
};

/** Cruce entre mis listas y las de otro. */
export function matchTrades(
  mine: { wishlist: readonly ListedCard[]; tradelist: readonly ListedCard[] },
  theirs: { wishlist: readonly ListedCard[]; tradelist: readonly ListedCard[] },
): TradeMatch {
  return {
    theyHave: intersect(mine.wishlist, theirs.tradelist),
    theyWant: intersect(theirs.wishlist, mine.tradelist),
  };
}

/** Valor (EUR) de unas cartas con sus copias; las que no tienen precio no suman. */
export const listValue = (cards: readonly ListedCard[], prices: ReadonlyMap<string, number>) =>
  Math.round(cards.reduce((n, c) => n + (prices.get(c.oracleId) ?? 0) * c.quantity, 0) * 100) / 100;
