import type { CardUsage } from "../suggestions/engine";
import type { Combo, ComboCard } from "./types";

export type MissingStatus = "owned" | "in_other_decks" | "buy";

export interface OneAwayCombo {
  combo: Combo;
  /** La carta que falta en el mazo. */
  missing: ComboCard;
  /** La tengo libre, la tengo pero en otros mazos, o hay que comprarla. */
  status: MissingStatus;
  price: number | null;
}

/**
 * Combos a una carta, con la que falta y si la tengo. Primero los que completo con mi colección
 * (libres, luego en otros mazos), luego los que hay que comprar; dentro, los más jugados.
 */
export function oneAwayCombos(
  combos: readonly Combo[],
  ctx: {
    deck: ReadonlySet<string>;
    owned: ReadonlyMap<string, number>;
    usage?: ReadonlyMap<string, CardUsage> | undefined;
    prices: ReadonlyMap<string, number>;
  },
): OneAwayCombo[] {
  const rank: Record<MissingStatus, number> = { owned: 0, in_other_decks: 1, buy: 2 };
  return combos
    .flatMap((combo): OneAwayCombo[] => {
      const missing = combo.cards.filter((c) => !c.oracleId || !ctx.deck.has(c.oracleId));
      const card = missing[0];
      if (missing.length !== 1 || !card) return [];
      const id = card.oracleId;
      const have = id ? (ctx.owned.get(id) ?? 0) : 0;
      const free = have - (id ? (ctx.usage?.get(id)?.quantity ?? 0) : 0);
      const status: MissingStatus = free > 0 ? "owned" : have > 0 ? "in_other_decks" : "buy";
      return [{ combo, missing: card, status, price: id ? (ctx.prices.get(id) ?? null) : null }];
    })
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (b.combo.popularity ?? 0) - (a.combo.popularity ?? 0) ||
        a.combo.id.localeCompare(b.combo.id),
    );
}

export interface KeyCard {
  card: OneAwayCombo["missing"];
  /** Cuántos combos completa ella sola. */
  combos: number;
  status: MissingStatus;
  price: number | null;
}

/** Las cartas que más combos completan (de los que están a una carta), ya ordenadas. */
export function keyCards(oneAway: readonly OneAwayCombo[], limit: number): KeyCard[] {
  const byName = new Map<string, KeyCard>();
  for (const o of oneAway) {
    const k = byName.get(o.missing.name);
    if (k) k.combos += 1;
    else
      byName.set(o.missing.name, { card: o.missing, combos: 1, status: o.status, price: o.price });
  }
  return [...byName.values()]
    .filter((k) => k.combos > 1)
    .sort((a, b) => b.combos - a.combos || a.card.name.localeCompare(b.card.name))
    .slice(0, limit);
}

/** Bracket mínimo que implica un combo completo según su etiqueta de Spellbook. */
export function comboMinBracket(combo: Combo): 2 | 3 | 4 {
  if (combo.bracketTag === "R") return 4;
  if (combo.bracketTag === "S" || combo.bracketTag === "P") return 3;
  return 2;
}

/** "Thassa's Oracle + Demonic Consultation" */
export const comboName = (combo: Combo) => combo.cards.map((c) => c.name).join(" + ");
