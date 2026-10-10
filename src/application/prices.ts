import type { PriceHistory } from "@/domain/ports/price-history";

/** El día en UTC ("YYYY-MM-DD") con el que se guarda el precio. */
export const snapshotDate = (now: Date) => now.toISOString().slice(0, 10);

/** Guarda el precio de hoy de las cartas en colecciones y mazos (tras `scryfall:sync`). */
export async function recordPriceSnapshot(deps: { prices: PriceHistory }, now = new Date()) {
  const date = snapshotDate(now);
  return { date, cards: await deps.prices.recordSnapshot(date) };
}
