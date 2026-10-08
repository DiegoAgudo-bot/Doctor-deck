import type { Card } from "../cards/types";

/** Curva de maná de las cartas que no son tierra. Clave 7 = "7 o más". */
export function manaCurve(
  entries: readonly { card: Card; quantity: number }[],
): Record<number, number> {
  const curve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const { card, quantity } of entries) {
    if (/\bLand\b/.test(card.typeLine.split("//")[0] ?? "")) continue;
    const bucket = Math.min(7, Math.max(0, Math.floor(card.cmc)));
    curve[bucket] = (curve[bucket] ?? 0) + quantity;
  }
  return curve;
}
