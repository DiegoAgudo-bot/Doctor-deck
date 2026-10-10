import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type {
  FollowRepository,
  NotificationRepository,
  ProfileRepository,
  PublicProfile,
} from "@/domain/ports/social";
import type { TradeRepository } from "@/domain/ports/trades";
import {
  buildTradelist,
  buildWishlist,
  listValue,
  matchTrades,
  type ListedCard,
  type WishlistEntry,
} from "@/domain/trades/lists";

export interface TradeDeps {
  cards: CardRepository;
  collectionFor: (userId: string) => CollectionRepository;
  decksFor: (userId: string) => DeckRepository;
  tradesFor: (userId: string) => TradeRepository;
}

export interface UserLists {
  wishlist: WishlistEntry[];
  tradelist: ListedCard[];
  /** Cartas que he marcado como "no la cambio". */
  keep: Set<string>;
}

/** La lista de deseos y la de "para cambiar" de un usuario. */
export async function userLists(userId: string, deps: TradeDeps): Promise<UserLists> {
  const trades = deps.tradesFor(userId);
  const decks = deps.decksFor(userId);
  const [owned, usage, manual, markedDecks, keep] = await Promise.all([
    deps.collectionFor(userId).ownedQuantities(),
    decks.usage(),
    trades.wishes(),
    decks.wishlistDeckCards(),
    trades.keeps(),
  ]);
  const basics = await deps.cards.findBasicLandIds([...owned.keys(), ...markedDecks.keys()]);
  return {
    wishlist: buildWishlist({ manual, markedDecks, usage, owned, basics }),
    tradelist: buildTradelist({ owned, usage, keep, basics }),
    keep,
  };
}

export interface TradePartner {
  profile: PublicProfile & { username: string };
  following: boolean;
  theyHave: ListedCard[];
  theyWant: ListedCard[];
  /** Valor (EUR) de lo que tiene que quiero y de lo que quiere que tengo. */
  haveValue: number;
  wantValue: number;
}

/**
 * Cruces: de la gente con listas públicas, quién tiene libre lo que quiero y quién quiere lo que
 * me sobra. Primero la gente que sigo, después por el valor de lo que tienen para mí.
 */
export async function tradeMatches(
  viewerId: string,
  deps: TradeDeps & { profiles: ProfileRepository; follows: FollowRepository },
  opts: { username?: string | undefined } = {},
): Promise<{ partners: TradePartner[]; prices: Map<string, number> }> {
  const [mine, traders, following] = await Promise.all([
    userLists(viewerId, deps),
    deps.profiles.publicTraders(),
    deps.follows.followingIds(viewerId),
  ]);
  const followed = new Set(following);
  const others = traders.filter(
    (p): p is PublicProfile & { username: string } =>
      p.id !== viewerId &&
      p.username !== null &&
      (!opts.username || p.username === opts.username.toLowerCase()),
  );
  const matches = await Promise.all(
    others.map(async (profile) => ({
      profile,
      match: matchTrades(mine, await userLists(profile.id, deps)),
    })),
  );
  const prices = await deps.cards.findMinPrices([
    ...new Set(
      matches.flatMap((m) => [...m.match.theyHave, ...m.match.theyWant].map((c) => c.oracleId)),
    ),
  ]);
  const partners = matches
    .filter((m) => m.match.theyHave.length > 0 || m.match.theyWant.length > 0)
    .map((m) => ({
      profile: m.profile,
      following: followed.has(m.profile.id),
      ...m.match,
      haveValue: listValue(m.match.theyHave, prices),
      wantValue: listValue(m.match.theyWant, prices),
    }))
    .sort(
      (a, b) =>
        Number(b.following) - Number(a.following) ||
        b.haveValue - a.haveValue ||
        b.theyHave.length - a.theyHave.length ||
        a.profile.username.localeCompare(b.profile.username),
    );
  return { partners, prices };
}

/** No se vuelve a avisar de la misma carta antes de estos días. */
export const TRADE_MATCH_COOLDOWN_DAYS = 30;

/**
 * Aviso (cada noche) a quien tiene listas públicas: cartas de su lista de deseos que alguien con
 * listas públicas tiene libres. Como mucho un aviso por carta cada 30 días. Devuelve cuántos.
 */
export async function notifyTradeMatches(
  deps: TradeDeps & {
    profiles: ProfileRepository;
    follows: FollowRepository;
    notifications: NotificationRepository;
  },
  now = new Date(),
): Promise<number> {
  let created = 0;
  const since = new Date(now.getTime() - TRADE_MATCH_COOLDOWN_DAYS * 86_400_000);
  for (const user of await deps.profiles.publicTraders()) {
    const [{ partners }, alerted] = await Promise.all([
      tradeMatches(user.id, deps),
      deps.notifications.recentCardIds(user.id, "trade_match", since),
    ]);
    const seen = new Set(alerted);
    const items = partners.flatMap((p) =>
      p.theyHave.flatMap((c) => {
        if (seen.has(c.oracleId)) return [];
        seen.add(c.oracleId);
        return [{ actorId: p.profile.id, oracleId: c.oracleId }];
      }),
    );
    if (items.length === 0) continue;
    const names = new Map(
      (await deps.cards.findCardsByOracleIds(items.map((i) => i.oracleId))).map((c) => [
        c.oracleId,
        c.name,
      ]),
    );
    await deps.notifications.create(
      items.map((i) => ({
        userId: user.id,
        actorId: i.actorId,
        type: "trade_match" as const,
        cardId: i.oracleId,
        title: names.get(i.oracleId) ?? i.oracleId,
      })),
    );
    created += items.length;
  }
  return created;
}
