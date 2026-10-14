import type { Db } from "./prisma";

/** Cuánto se guarda de lo que crece cada día. */
export const PRUNE_POLICY = {
  /** Caché de servicios externos: la copia caducada sirve de respaldo, pero no meses. */
  httpCacheDays: 30,
  /** Avisos ya leídos. */
  readNotificationDays: 90,
  /** Cualquier aviso. */
  notificationDays: 365,
  /** Histórico de precios (la gráfica más larga es de un año). */
  priceDays: 400,
} as const;

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

/**
 * Borra lo viejo de las tablas que crecen solas (caché de recomendaciones y combos, avisos,
 * histórico de precios). Se lanza cada noche con `scryfall:sync`.
 */
export async function pruneOldData(db: Db, now = new Date(), policy = PRUNE_POLICY) {
  const priceCutoff = daysAgo(now, policy.priceDays).toISOString().slice(0, 10);
  const [cache, read, old, prices, printingPrices] = await Promise.all([
    db.httpCache.deleteMany({ where: { fetchedAt: { lt: daysAgo(now, policy.httpCacheDays) } } }),
    db.notification.deleteMany({
      where: {
        readAt: { not: null },
        createdAt: { lt: daysAgo(now, policy.readNotificationDays) },
      },
    }),
    db.notification.deleteMany({
      where: { createdAt: { lt: daysAgo(now, policy.notificationDays) } },
    }),
    db.priceSnapshot.deleteMany({ where: { date: { lt: priceCutoff } } }),
    db.printingPriceSnapshot.deleteMany({ where: { date: { lt: priceCutoff } } }),
  ]);
  return {
    cache: cache.count,
    notifications: read.count + old.count,
    prices: prices.count + printingPrices.count,
  };
}
