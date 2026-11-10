import type { CardUsage } from "../suggestions/engine";

/** Una carta que falta para montar todos mis mazos a la vez. */
export interface ShoppingItem {
  oracleId: string;
  /** Copias que hay que conseguir: las que piden mis mazos menos las que tengo. */
  quantity: number;
  /** Mazos que la llevan (nombre e id público si se sabe); también «Prestada a …». */
  decks: { id: string | null; name: string }[];
}

/**
 * Lista de la compra de todos mis mazos: lo que piden entre todos (y lo que tengo prestado)
 * menos lo que tengo, sin tierras básicas. Si dos mazos comparten una carta y solo tengo una
 * copia, falta una.
 */
export function shoppingList(input: {
  usage: ReadonlyMap<string, CardUsage>;
  owned: ReadonlyMap<string, number>;
  basics: ReadonlySet<string>;
}): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  for (const [oracleId, use] of input.usage) {
    if (input.basics.has(oracleId)) continue;
    const quantity = use.quantity - (input.owned.get(oracleId) ?? 0);
    if (quantity <= 0) continue;
    items.push({
      oracleId,
      quantity,
      decks: use.decks.map((name, i) => ({ id: use.deckIds?.[i] ?? null, name })),
    });
  }
  return items;
}
