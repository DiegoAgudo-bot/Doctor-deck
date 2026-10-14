import { excerpt, type FeedItem } from "@/domain/feed/feed";
import type { FeedSource } from "@/domain/ports/feed";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

const ACTOR = { id: true, username: true, name: true } as const;
const DECK = {
  publicId: true,
  name: true,
  commanderNames: true,
  cards: { where: { isCommander: true }, select: { oracleId: true } },
} satisfies Prisma.DeckSelect;

const deckOf = (d: Prisma.DeckGetPayload<{ select: typeof DECK }>) => ({
  id: d.publicId,
  name: d.name,
  commanders: d.commanderNames ? d.commanderNames.split("\n") : [],
  commanderIds: d.cards.map((c) => c.oracleId),
});

const actorOf = (u: { id: string; username: string | null; name: string }) =>
  u.username ? { id: u.id, username: u.username, name: u.name } : null;

/** Lo que alimenta el feed, sacado de las tablas de siempre (no hay tabla de actividad). */
export class PrismaFeedSource implements FeedSource {
  constructor(private readonly db: Db) {}

  async activity(actorIds: readonly string[], viewerId: string, before: Date, limit: number) {
    const ids = [...actorIds];
    if (ids.length === 0) return [];
    const listed = { visibility: "public" } as const;
    const [decks, likes, comments, players, trades, myGroups] = await Promise.all([
      this.db.deck.findMany({
        where: { userId: { in: ids }, ...listed, createdAt: { lt: before } },
        select: { ...DECK, createdAt: true, user: { select: ACTOR } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      this.db.deckLike.findMany({
        where: { userId: { in: ids }, deck: listed, createdAt: { lt: before } },
        select: {
          createdAt: true,
          user: { select: ACTOR },
          deck: { select: { ...DECK, user: { select: { username: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      this.db.deckComment.findMany({
        where: { authorId: { in: ids }, hiddenAt: null, deck: listed, createdAt: { lt: before } },
        select: {
          publicId: true,
          body: true,
          createdAt: true,
          author: { select: ACTOR },
          deck: { select: DECK },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      this.db.gamePlayer.findMany({
        where: { userId: { in: ids }, game: { playedAt: { lt: before } } },
        select: {
          winner: true,
          deckName: true,
          user: { select: ACTOR },
          game: {
            select: {
              publicId: true,
              playedAt: true,
              groupId: true,
              group: { select: { publicId: true, name: true } },
              players: {
                select: {
                  winner: true,
                  guestName: true,
                  user: { select: { username: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { game: { playedAt: "desc" } },
        // Una fila por jugador y luego una entrada por partida: con varios amigos en la misma,
        // `limit` filas darían menos partidas (y la página se cortaría antes de tiempo). Una
        // partida tiene como mucho 8 jugadores.
        take: limit * 8,
      }),
      this.db.tradeProposal.findMany({
        where: {
          status: "accepted",
          closedAt: { lt: before },
          OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }],
          fromUser: { tradesPublic: true },
          toUser: { tradesPublic: true },
        },
        select: {
          publicId: true,
          version: true,
          closedAt: true,
          fromUser: { select: ACTOR },
          toUser: { select: ACTOR },
          items: { select: { version: true, quantity: true } },
        },
        orderBy: { closedAt: "desc" },
        take: limit,
      }),
      this.db.groupMember.findMany({ where: { userId: viewerId }, select: { groupId: true } }),
    ]);
    const inMyGroups = new Set(myGroups.map((g) => g.groupId));
    const followed = new Set(ids);

    const deckItems: FeedItem[] = decks.flatMap((d) => {
      const actor = actorOf(d.user!);
      return actor
        ? [{ id: `deck:${d.publicId}`, at: d.createdAt, actor, type: "deck", deck: deckOf(d) }]
        : [];
    });
    const likeItems: FeedItem[] = likes.flatMap((l) => {
      const actor = actorOf(l.user);
      const owner = l.deck.user?.username;
      return actor && owner
        ? [
            {
              id: `like:${actor.id}:${l.deck.publicId}`,
              at: l.createdAt,
              actor,
              type: "like",
              deck: deckOf(l.deck),
              owner: { username: owner },
            },
          ]
        : [];
    });
    const commentItems: FeedItem[] = comments.flatMap((c) => {
      const actor = actorOf(c.author);
      return actor
        ? [
            {
              id: `comment:${c.publicId}`,
              at: c.createdAt,
              actor,
              type: "comment",
              deck: deckOf(c.deck),
              excerpt: excerpt(c.body),
            },
          ]
        : [];
    });
    // Una entrada por partida aunque jueguen varios a los que sigo: la del ganador, si es uno de
    // ellos; si no, la del primero.
    const byGame = new Map<string, (typeof players)[number]>();
    for (const p of players) {
      const prev = byGame.get(p.game.publicId);
      if (!prev || (p.winner && !prev.winner)) byGame.set(p.game.publicId, p);
    }
    const gameItems: FeedItem[] = [...byGame.values()].flatMap((p) => {
      const actor = p.user && actorOf(p.user);
      if (!actor) return [];
      const winner = p.game.players.find((x) => x.winner);
      return [
        {
          id: `game:${p.game.publicId}`,
          at: p.game.playedAt,
          actor,
          type: "game",
          game: {
            id: p.game.publicId,
            // El nombre del grupo solo si soy miembro.
            group:
              p.game.group && p.game.groupId !== null && inMyGroups.has(p.game.groupId)
                ? { id: p.game.group.publicId, name: p.game.group.name }
                : null,
            players: p.game.players.length,
            won: p.winner,
            deckName: p.deckName,
            winner: winner
              ? winner.user
                ? winner.user.username
                  ? `@${winner.user.username}`
                  : winner.user.name
                : (winner.guestName ?? null)
              : null,
          },
        },
      ];
    });
    const tradeItems: FeedItem[] = trades.flatMap((t) => {
      // Desde el punto de vista del que sigo (si sigo a los dos, del que la propuso).
      const [me, other] = followed.has(t.fromUser.id)
        ? [t.fromUser, t.toUser]
        : [t.toUser, t.fromUser];
      const actor = actorOf(me);
      if (!actor || !other.username || !t.closedAt) return [];
      return [
        {
          id: `trade:${t.publicId}`,
          at: t.closedAt,
          actor,
          type: "trade",
          partner: { username: other.username },
          cards: t.items.filter((i) => i.version === t.version).reduce((n, i) => n + i.quantity, 0),
        },
      ];
    });
    return [deckItems, likeItems, commentItems, gameItems, tradeItems];
  }
}
