import type { CardUsage } from "../suggestions/engine";

/** Copias prestadas (aún sin devolver) de una carta. */
export interface ActiveLoan {
  oracleId: string;
  quantity: number;
  /** "@ana" o el nombre de quien no tiene cuenta. */
  to: string;
}

/**
 * Suma los préstamos al uso de los mazos: una carta prestada sigue siendo mía, pero no está libre
 * (ni para el motor, ni para cambiar, ni para otros mazos). Sale como "Prestada a @ana".
 */
export function withLoans(
  usage: ReadonlyMap<string, CardUsage>,
  loans: readonly ActiveLoan[],
): Map<string, CardUsage> {
  const out = new Map(
    [...usage].map(([k, u]) => [
      k,
      { ...u, decks: [...u.decks], ...(u.deckIds ? { deckIds: [...u.deckIds] } : {}) },
    ]),
  );
  for (const l of loans) {
    if (l.quantity <= 0) continue;
    const u = out.get(l.oracleId) ?? { quantity: 0, decks: [], deckIds: [] };
    u.quantity += l.quantity;
    const label = `Prestada a ${l.to}`;
    if (!u.decks.includes(label)) u.decks.push(label);
    out.set(l.oracleId, u);
  }
  return out;
}
