import type {
  FollowRepository,
  NewNotification,
  NotificationRepository,
  ProfileRepository,
  PublicProfile,
} from "@/domain/ports/social";
import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

const PROFILE = {
  id: true,
  username: true,
  name: true,
  image: true,
  collectionPublic: true,
  createdAt: true,
} as const;

/** Perfiles, seguidores y notificaciones (la parte social), sobre las tablas de usuarios. */
export class PrismaSocialRepository
  implements ProfileRepository, FollowRepository, NotificationRepository
{
  constructor(private readonly db: Db) {}

  // ---------- perfiles ----------

  async byId(id: string): Promise<PublicProfile | null> {
    return this.db.user.findUnique({ where: { id }, select: PROFILE });
  }

  async byUsername(username: string): Promise<PublicProfile | null> {
    return this.db.user.findUnique({ where: { username }, select: PROFILE });
  }

  async emailOf(id: string) {
    return (
      (await this.db.user.findUnique({ where: { id }, select: { email: true } }))?.email ?? null
    );
  }

  async setUsername(userId: string, username: string) {
    try {
      await this.db.user.update({ where: { id: userId }, data: { username } });
      return true;
    } catch (err) {
      // P2002: el índice único de username.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
      throw err;
    }
  }

  async setCollectionPublic(userId: string, value: boolean) {
    await this.db.user.update({ where: { id: userId }, data: { collectionPublic: value } });
  }

  async search(query: string, limit: number) {
    const q = query.trim().toLowerCase();
    const users = await this.db.user.findMany({
      where: {
        username: { not: null },
        ...(q ? { OR: [{ username: { contains: q } }, { name: { contains: q } }] } : {}),
      },
      select: {
        ...PROFILE,
        _count: { select: { followers: true, decks: { where: { visibility: "public" } } } },
      },
      orderBy: q ? { username: "asc" } : { decks: { _count: "desc" } },
      take: limit,
    });
    return users.map(({ _count, ...u }) => ({
      ...u,
      followers: _count.followers,
      publicDecks: _count.decks,
    }));
  }

  // ---------- seguir ----------

  async follow(followerId: string, followedId: string) {
    await this.db.follow.upsert({
      where: { followerId_followedId: { followerId, followedId } },
      create: { followerId, followedId },
      update: {},
    });
  }

  async unfollow(followerId: string, followedId: string) {
    await this.db.follow.deleteMany({ where: { followerId, followedId } });
  }

  async isFollowing(followerId: string, followedId: string) {
    return (await this.db.follow.count({ where: { followerId, followedId } })) > 0;
  }

  async counts(userId: string) {
    const [followers, following] = await Promise.all([
      this.db.follow.count({ where: { followedId: userId } }),
      this.db.follow.count({ where: { followerId: userId } }),
    ]);
    return { followers, following };
  }

  async followerIds(userId: string) {
    const rows = await this.db.follow.findMany({
      where: { followedId: userId },
      select: { followerId: true },
    });
    return rows.map((r) => r.followerId);
  }

  async followingIds(userId: string) {
    const rows = await this.db.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    });
    return rows.map((r) => r.followedId);
  }

  // ---------- notificaciones ----------

  async create(items: readonly NewNotification[]) {
    if (items.length === 0) return;
    await this.db.notification.createMany({
      data: items.map((n) => ({
        userId: n.userId,
        actorId: n.actorId,
        type: n.type,
        deckId: n.deckId ?? null,
        cardId: n.cardId ?? null,
        title: n.title,
        price: n.price ?? null,
      })),
    });
  }

  async list(userId: string, limit: number) {
    const rows = await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { username: true, name: true } } },
    });
    return rows.map((r) => ({
      id: String(r.id),
      userId: r.userId,
      actorId: r.actorId,
      actor: r.actor,
      type: r.type === "big_card" ? ("big_card" as const) : ("new_deck" as const),
      deckId: r.deckId,
      cardId: r.cardId,
      title: r.title,
      price: r.price,
      createdAt: r.createdAt,
      read: r.readAt !== null,
    }));
  }

  async unreadCount(userId: string) {
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  async markAllRead(userId: string) {
    await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
