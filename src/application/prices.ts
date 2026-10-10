import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { PriceHistory } from "@/domain/ports/price-history";
import type { NotificationRepository, ProfileRepository } from "@/domain/ports/social";
import {
  collectionValueSeries,
  daysBefore,
  priceDrop,
  priceMovers,
  type PricePoint,
} from "@/domain/prices/history";

/** El día en UTC ("YYYY-MM-DD") con el que se guarda el precio. */
export const snapshotDate = (now: Date) => now.toISOString().slice(0, 10);

/** Guarda el precio de hoy de las cartas en colecciones y mazos (tras `scryfall:sync`). */
export async function recordPriceSnapshot(deps: { prices: PriceHistory }, now = new Date()) {
  const date = snapshotDate(now);
  const [cards, printings] = await Promise.all([
    deps.prices.recordSnapshot(date),
    deps.prices.recordPrintingSnapshot(date),
  ]);
  return { date, cards, printings };
}

/** Días de histórico con los que se compara para avisar de una bajada. */
export const PRICE_DROP_WINDOW_DAYS = 30;
/** No se vuelve a avisar de la misma carta antes de estos días. */
export const PRICE_DROP_COOLDOWN_DAYS = 7;

/** Copias de una carta en mi colección: con impresión (y foil) si se conocen. */
export interface Holding {
  oracleId: string;
  scryfallId: string | null;
  foil: boolean;
  quantity: number;
}

/** Clave de una impresión concreta (normal o foil) o, si no se sabe, de la carta. */
const holdingKey = (h: Holding) =>
  h.scryfallId ? `p:${h.scryfallId.toLowerCase()}:${h.foil ? "f" : "n"}` : `o:${h.oracleId}`;

/**
 * Lo que ha subido y bajado mi colección en los últimos `days` días, y su valor día a día. Cada
 * copia va con el precio de su impresión (normal o foil) si se sabe y hay histórico; si no, con el
 * de la impresión más barata de la carta.
 */
export async function collectionPrices(
  req: { holdings: readonly Holding[]; days: number; limit: number },
  deps: { prices: PriceHistory },
) {
  const latest = await deps.prices.latestDate();
  if (!latest) return { since: null, latest: null, value: [], up: [], down: [], info: new Map() };
  const since = daysBefore(latest, req.days);
  const [printingHistories, cardHistories] = await Promise.all([
    deps.prices.printingHistoryMany(
      req.holdings.flatMap((h) => (h.scryfallId ? [h.scryfallId] : [])),
      since,
    ),
    deps.prices.historyMany([...new Set(req.holdings.map((h) => h.oracleId))], since),
  ]);
  const owned = new Map<string, number>();
  const histories = new Map<string, PricePoint[]>();
  const info = new Map<string, Holding>();
  for (const h of req.holdings) {
    let key = holdingKey(h);
    let history: PricePoint[] | undefined;
    if (h.scryfallId) {
      history = (printingHistories.get(h.scryfallId.toLowerCase()) ?? []).flatMap((p) => {
        const eur = h.foil ? (p.eurFoil ?? p.eur) : (p.eur ?? p.eurFoil);
        return eur === null ? [] : [{ date: p.date, eur }];
      });
      if (history.length === 0) history = undefined;
    }
    if (!history) {
      // Sin histórico de su impresión: el de la carta (la más barata).
      key = `o:${h.oracleId}`;
      history = cardHistories.get(h.oracleId) ?? [];
    }
    owned.set(key, (owned.get(key) ?? 0) + h.quantity);
    histories.set(key, history);
    if (!info.has(key))
      info.set(key, { ...h, scryfallId: key.startsWith("p:") ? h.scryfallId : null });
  }
  return {
    since,
    latest,
    value: collectionValueSeries(owned, histories),
    ...priceMovers(owned, histories, req.limit),
    /** De qué carta (e impresión) es cada clave de `up`/`down`. */
    info,
  };
}

/**
 * Avisos de bajada de precio (tras guardar los precios del día): a cada usuario con avisos
 * activados, de las cartas que le faltan para alguno de sus mazos guardados, si su precio de hoy
 * ha bajado su % respecto al máximo de los 30 días anteriores. Como mucho un aviso por carta cada
 * 7 días. Devuelve cuántos avisos creó.
 */
export async function notifyPriceDrops(
  deps: {
    prices: PriceHistory;
    profiles: ProfileRepository;
    notifications: NotificationRepository;
    cards: CardRepository;
    collectionFor: (userId: string) => CollectionRepository;
    decksFor: (userId: string) => DeckRepository;
  },
  now = new Date(),
): Promise<number> {
  const today = snapshotDate(now);
  let created = 0;
  for (const user of await deps.profiles.priceAlertUsers()) {
    const [owned, usage] = await Promise.all([
      deps.collectionFor(user.id).ownedQuantities(),
      deps.decksFor(user.id).usage(),
    ]);
    // Lo que me falta para montar todos mis mazos a la vez.
    const missing = [...usage].filter(([id, u]) => u.quantity > (owned.get(id) ?? 0));
    if (missing.length === 0) continue;
    const ids = missing.map(([id]) => id);
    const [basics, histories, alerted] = await Promise.all([
      deps.cards.findBasicLandIds(ids),
      deps.prices.historyMany(ids, daysBefore(today, PRICE_DROP_WINDOW_DAYS)),
      deps.notifications.recentCardIds(
        user.id,
        "price_drop",
        new Date(now.getTime() - PRICE_DROP_COOLDOWN_DAYS * 86_400_000),
      ),
    ]);
    const drops = missing.flatMap(([id, u]) => {
      const history = histories.get(id) ?? [];
      // Solo si hay precio de hoy (si el sync falló, no se compara con datos viejos).
      if (basics.has(id) || alerted.has(id) || history.at(-1)?.date !== today) return [];
      const drop = priceDrop(id, history, user.percent);
      return drop ? [{ drop, deckId: u.deckIds?.[0] ?? null }] : [];
    });
    if (drops.length === 0) continue;
    const names = new Map(
      (await deps.cards.findCardsByOracleIds(drops.map((d) => d.drop.oracleId))).map((c) => [
        c.oracleId,
        c.name,
      ]),
    );
    await deps.notifications.create(
      drops.map(({ drop, deckId }) => ({
        userId: user.id,
        actorId: user.id,
        type: "price_drop" as const,
        cardId: drop.oracleId,
        deckId,
        title: names.get(drop.oracleId) ?? drop.oracleId,
        price: drop.now,
        prevPrice: drop.reference,
      })),
    );
    created += drops.length;
  }
  return created;
}
