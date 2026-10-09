/** Forma mínima de un mazo para exportarlo (la usan también los componentes de cliente). */
export interface ExportableDeck {
  commanders: readonly { oracleId: string; name: string }[];
  cards: readonly { oracleId: string; name: string; quantity: number }[];
}

export interface AcceptedSwap {
  outOracleId: string;
  in: { oracleId: string; name: string };
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
    else cards.push({ oracleId: swap.in.oracleId, name: swap.in.name, quantity: 1 });
  }
  return { commanders: deck.commanders, cards: cards.filter((c) => c.quantity > 0) };
}

/**
 * Cambia las copias de una carta en las 99: `delta` positivo añade, negativo quita (si llega a 0,
 * la carta sale del mazo). Los comandantes no se tocan.
 */
export function changeCard(
  deck: ExportableDeck,
  card: { oracleId: string; name: string },
  delta: number,
): ExportableDeck {
  if (deck.commanders.some((c) => c.oracleId === card.oracleId)) return deck;
  const cards = deck.cards.map((c) => ({ ...c }));
  const existing = cards.find((c) => c.oracleId === card.oracleId);
  if (existing) existing.quantity += delta;
  else if (delta > 0) cards.push({ oracleId: card.oracleId, name: card.name, quantity: delta });
  return { commanders: deck.commanders, cards: cards.filter((c) => c.quantity > 0) };
}

/** Texto en formato estándar (Moxfield/Archidekt/Arena lo importan): secciones Commander y Deck. */
export function exportDecklist(deck: ExportableDeck): string {
  const lines = ["Commander", ...deck.commanders.map((c) => `1 ${c.name}`), "", "Deck"];
  const sorted = [...deck.cards].sort((a, b) => a.name.localeCompare(b.name));
  for (const c of sorted) lines.push(`${c.quantity} ${c.name}`);
  return `${lines.join("\n")}\n`;
}
