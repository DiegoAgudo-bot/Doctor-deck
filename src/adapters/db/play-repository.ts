import { randomBytes } from "node:crypto";
import type {
  Game,
  GameFilter,
  GameRepository,
  Group,
  GroupRepository,
  GroupSummary,
  NewGame,
} from "@/domain/ports/play";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

const MEMBER = { id: true, username: true, name: true, image: true } as const;

/** Código del enlace de invitación: 12 caracteres URL-safe (72 bits). */
const inviteCode = () => randomBytes(9).toString("base64url");

/** Grupos de juego. */
export class PrismaGroupRepository implements GroupRepository {
  constructor(private readonly db: Db) {}

  async create(data: { ownerId: string; name: string; description: string }) {
    const g = await this.db.playGroup.create({
      data: {
        ...data,
        inviteCode: inviteCode(),
        members: { create: { userId: data.ownerId } },
      },
    });
    return g.publicId;
  }

  async get(id: string): Promise<Group | null> {
    const g = await this.db.playGroup.findUnique({
      where: { publicId: id },
      include: {
        members: { include: { user: { select: MEMBER } }, orderBy: { joinedAt: "asc" } },
      },
    });
    if (!g) return null;
    return {
      id: g.publicId,
      name: g.name,
      description: g.description,
      ownerId: g.ownerId,
      inviteCode: g.inviteCode,
      createdAt: g.createdAt,
      members: g.members.map((m) => ({ ...m.user, joinedAt: m.joinedAt })),
    };
  }

  private async summaries(where: Parameters<Db["playGroup"]["findMany"]>[0]) {
    const rows = await this.db.playGroup.findMany({
      ...where,
      include: {
        _count: { select: { members: true, games: true } },
        games: { select: { playedAt: true }, orderBy: { playedAt: "desc" }, take: 1 },
      },
    });
    return rows.map((g): GroupSummary => ({
      id: g.publicId,
      name: g.name,
      description: g.description,
      ownerId: g.ownerId,
      members: g._count.members,
      games: g._count.games,
      lastGameAt: g.games[0]?.playedAt ?? null,
    }));
  }

  async byInvite(code: string) {
    return (await this.summaries({ where: { inviteCode: code } }))[0] ?? null;
  }

  async forUser(userId: string) {
    const groups = await this.summaries({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    });
    return groups.sort((a, b) => (b.lastGameAt?.getTime() ?? 0) - (a.lastGameAt?.getTime() ?? 0));
  }

  async isMember(groupId: string, userId: string) {
    return (
      (await this.db.groupMember.count({ where: { group: { publicId: groupId }, userId } })) > 0
    );
  }

  async join(groupId: string, userId: string) {
    const g = await this.db.playGroup.findUnique({ where: { publicId: groupId } });
    if (!g) return;
    await this.db.groupMember.upsert({
      where: { groupId_userId: { groupId: g.id, userId } },
      create: { groupId: g.id, userId },
      update: {},
    });
  }

  async removeMember(groupId: string, userId: string) {
    await this.db.groupMember.deleteMany({
      where: { group: { publicId: groupId, ownerId: { not: userId } }, userId },
    });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.db.playGroup.updateMany({ where: { publicId: id }, data });
  }

  async newInvite(id: string) {
    const code = inviteCode();
    await this.db.playGroup.updateMany({ where: { publicId: id }, data: { inviteCode: code } });
    return code;
  }

  async delete(id: string) {
    await this.db.playGroup.deleteMany({ where: { publicId: id } });
  }

  async groupmateIds(userId: string) {
    const rows = await this.db.groupMember.findMany({
      where: { group: { members: { some: { userId } } }, userId: { not: userId } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.map((r) => r.userId);
  }
}

const GAME_INCLUDE = {
  group: { select: { publicId: true, name: true } },
  players: {
    orderBy: { seat: "asc" },
    include: { user: { select: MEMBER }, deck: { select: { publicId: true } } },
  },
} satisfies Prisma.GameInclude;

type GameRow = Prisma.GameGetPayload<{ include: typeof GAME_INCLUDE }>;

function gameFromRow(g: GameRow): Game {
  return {
    id: g.publicId,
    group: g.group ? { id: g.group.publicId, name: g.group.name } : null,
    createdById: g.createdById,
    playedAt: g.playedAt,
    turns: g.turns,
    notes: g.notes,
    players: g.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      user: p.user,
      guestName: p.guestName,
      deckId: p.deck?.publicId ?? null,
      deckName: p.deckName,
      commanderNames: p.commanderNames ? p.commanderNames.split("\n") : [],
      winner: p.winner,
    })),
  };
}

/** Partidas jugadas. */
export class PrismaGameRepository implements GameRepository {
  constructor(private readonly db: Db) {}

  async create(game: NewGame) {
    const [group, decks] = await Promise.all([
      game.groupId
        ? this.db.playGroup.findUnique({ where: { publicId: game.groupId }, select: { id: true } })
        : null,
      this.db.deck.findMany({
        where: { publicId: { in: game.players.flatMap((p) => (p.deckId ? [p.deckId] : [])) } },
        select: { id: true, publicId: true },
      }),
    ]);
    const deckIds = new Map(decks.map((d) => [d.publicId, d.id]));
    const g = await this.db.game.create({
      data: {
        groupId: group?.id ?? null,
        createdById: game.createdById,
        playedAt: game.playedAt,
        turns: game.turns,
        notes: game.notes,
        players: {
          create: game.players.map((p, seat) => ({
            seat,
            userId: p.userId,
            guestName: p.guestName,
            deckId: p.deckId ? (deckIds.get(p.deckId) ?? null) : null,
            deckName: p.deckName,
            commanderNames: p.commanderNames.join("\n"),
            winner: p.winner,
          })),
        },
      },
    });
    return g.publicId;
  }

  private rows(where: Prisma.GameWhereInput, take: number) {
    return this.db.game.findMany({
      where,
      include: GAME_INCLUDE,
      orderBy: [{ playedAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  async get(id: string) {
    const [g] = await this.rows({ publicId: id }, 1);
    return g ? gameFromRow(g) : null;
  }

  async list(filter: GameFilter, limit: number, before?: Date) {
    const rows = await this.rows(
      {
        ...(filter.groupId ? { group: { publicId: filter.groupId } } : {}),
        ...(filter.userId || filter.deckId
          ? {
              players: {
                some: {
                  ...(filter.userId ? { userId: filter.userId } : {}),
                  ...(filter.deckId ? { deck: { publicId: filter.deckId } } : {}),
                },
              },
            }
          : {}),
        ...(before ? { playedAt: { lt: before } } : {}),
      },
      limit,
    );
    return rows.map(gameFromRow);
  }

  async delete(id: string) {
    await this.db.game.deleteMany({ where: { publicId: id } });
  }
}
