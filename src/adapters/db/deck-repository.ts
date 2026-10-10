import { toBracket, type Bracket } from "@/domain/deck/bracket";
import { canOpenDeck, toDeckVisibility, type DeckVisibility } from "@/domain/deck/visibility";
import type {
  DeckRepository,
  SaveDeckData,
  SavedDeck,
  SavedDeckSummary,
} from "@/domain/ports/deck-repository";
import type { DeckFacts } from "@/domain/deck/facts";
import type {
  CommunityDeckRow,
  CommunityFilters,
  DeckForFacts,
  PublicDecks,
} from "@/domain/ports/social";
import type { CardUsage } from "@/domain/suggestions/engine";
import type { Db } from "./prisma";

const parseIds = (json: string): string[] => {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Ya existe un mazo con ese id, pero es de otro usuario (o no existe). */
export class DeckNotFoundError extends Error {
  constructor() {
    super("Ese mazo no existe");
  }
}

type DeckRow = Awaited<ReturnType<Db["deck"]["findFirstOrThrow"]>> & {
  cards: { oracleId: string; quantity: number; isCommander: boolean; locked: boolean }[];
};

function savedDeckFromRow(d: DeckRow): SavedDeck {
  return {
    id: d.publicId,
    name: d.name,
    source: d.source,
    commanderNames: d.commanderNames ? d.commanderNames.split("\n") : [],
    cardCount: d.cards.reduce((n, c) => n + c.quantity, 0),
    updatedAt: d.updatedAt,
    visibility: toDeckVisibility(d.visibility),
    input: d.input,
    targetBracket: toBracket(d.targetBracket),
    theme: d.theme,
    commanders: d.cards.filter((c) => c.isCommander).map((c) => c.oracleId),
    locked: d.cards.filter((c) => c.locked).map((c) => c.oracleId),
    excluded: parseIds(d.excluded),
  };
}

/** Mazos públicos de cualquiera (para perfiles, enlaces compartidos y la comunidad). */
export class PrismaPublicDecks implements PublicDecks {
  constructor(private readonly db: Db) {}

  async find(id: string, viewerId: string | null) {
    const d = await this.db.deck.findUnique({ where: { publicId: id }, include: { cards: true } });
    if (!d?.userId || !canOpenDeck(toDeckVisibility(d.visibility), d.userId, viewerId)) return null;
    return { deck: savedDeckFromRow(d), ownerId: d.userId };
  }

  async search(filters: CommunityFilters, limit: number): Promise<CommunityDeckRow[]> {
    const q = filters.q?.trim();
    const decks = await this.db.deck.findMany({
      where: {
        visibility: "public",
        user: { username: { not: null } },
        ...(q ? { OR: [{ name: { contains: q } }, { commanderNames: { contains: q } }] } : {}),
        ...(filters.colors !== undefined ? { colorIdentity: filters.colors } : {}),
        ...(filters.bracket !== undefined ? { bracket: filters.bracket } : {}),
        ...(filters.ownerIds ? { userId: { in: [...filters.ownerIds] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        cards: { select: { oracleId: true, quantity: true, isCommander: true, locked: true } },
        _count: { select: { likes: true } },
      },
    });
    return decks.flatMap((d) =>
      d.userId
        ? [
            {
              ...savedDeckFromRow(d),
              ownerId: d.userId,
              createdAt: d.createdAt,
              likes: d._count.likes,
              bracket: d.bracket,
              cards: d.cards.map((c) => ({ oracleId: c.oracleId, quantity: c.quantity })),
            },
          ]
        : [],
    );
  }

  async likedBy(viewerId: string, deckIds: readonly string[]) {
    const rows = await this.db.deckLike.findMany({
      where: { userId: viewerId, deck: { publicId: { in: [...deckIds] } } },
      select: { deck: { select: { publicId: true } } },
    });
    return new Set(rows.map((r) => r.deck.publicId));
  }

  async setLike(viewerId: string, deckId: string, like: boolean) {
    const d = await this.db.deck.findUnique({
      where: { publicId: deckId },
      select: { id: true, userId: true, visibility: true },
    });
    if (
      !d?.userId ||
      d.userId === viewerId ||
      !canOpenDeck(toDeckVisibility(d.visibility), d.userId, viewerId)
    )
      return null;
    const key = { userId_deckId: { userId: viewerId, deckId: d.id } };
    if (like) await this.db.deckLike.upsert({ where: key, create: key.userId_deckId, update: {} });
    else await this.db.deckLike.deleteMany({ where: key.userId_deckId });
    return { likes: await this.db.deckLike.count({ where: { deckId: d.id } }) };
  }

  async likes(deckId: string) {
    return this.db.deckLike.count({ where: { deck: { publicId: deckId } } });
  }

  async withoutFacts(all: boolean, limit: number, offset: number): Promise<DeckForFacts[]> {
    const decks = await this.db.deck.findMany({
      where: all ? {} : { OR: [{ colorIdentity: null }, { bracket: null }] },
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
      select: {
        publicId: true,
        cards: { select: { oracleId: true, quantity: true, isCommander: true } },
      },
    });
    return decks.map((d) => ({
      id: d.publicId,
      commanders: d.cards.filter((c) => c.isCommander).map((c) => c.oracleId),
      cards: d.cards
        .filter((c) => !c.isCommander)
        .map(({ oracleId, quantity }) => ({ oracleId, quantity })),
    }));
  }

  async setFacts(deckId: string, facts: DeckFacts) {
    // SQL directo: con `update` Prisma cambiaría `updatedAt` y el mazo parecería editado.
    await this.db.$executeRaw`
      UPDATE "Deck" SET "colorIdentity" = ${facts.colorIdentity}, "bracket" = ${facts.bracket}
      WHERE "publicId" = ${deckId}`;
  }
}

/** Mazos de UN usuario: todas las consultas se filtran por `userId`. */
export class PrismaDeckRepository implements DeckRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async list(): Promise<SavedDeckSummary[]> {
    const decks = await this.db.deck.findMany({
      where: { userId: this.userId },
      orderBy: { updatedAt: "desc" },
      include: { cards: { select: { quantity: true, isCommander: true, oracleId: true } } },
    });
    return decks.map((d) => ({
      id: d.publicId,
      name: d.name,
      source: d.source,
      commanderNames: d.commanderNames ? d.commanderNames.split("\n") : [],
      commanders: d.cards.filter((c) => c.isCommander).map((c) => c.oracleId),
      cardCount: d.cards.reduce((n, c) => n + c.quantity, 0),
      updatedAt: d.updatedAt,
      visibility: toDeckVisibility(d.visibility),
    }));
  }

  async get(id: string): Promise<SavedDeck | null> {
    const d = await this.db.deck.findFirst({
      where: { publicId: id, userId: this.userId },
      include: { cards: true },
    });
    return d ? savedDeckFromRow(d) : null;
  }

  async save(data: SaveDeckData): Promise<string> {
    const locked = new Set(data.locked);
    const cards = [
      ...data.commanders.map((c) => ({
        oracleId: c.oracleId,
        quantity: 1,
        isCommander: true,
        locked: false,
      })),
      ...data.cards.map((c) => ({
        oracleId: c.oracleId,
        quantity: c.quantity,
        isCommander: false,
        locked: locked.has(c.oracleId),
      })),
    ];
    const fields = {
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      ...(data.targetBracket !== undefined ? { targetBracket: data.targetBracket } : {}),
      ...(data.facts ? data.facts : {}),
      name: data.name,
      input: data.input,
      source: data.source,
      theme: data.theme,
      commanderNames: data.commanders.map((c) => c.name).join("\n"),
      excluded: JSON.stringify(data.excluded),
    };
    return this.db.$transaction(async (tx) => {
      if (data.id !== undefined) {
        const own = await tx.deck.findFirst({
          where: { publicId: data.id, userId: this.userId },
          select: { id: true },
        });
        if (!own) throw new DeckNotFoundError();
        await tx.deckCard.deleteMany({ where: { deckId: own.id } });
        await tx.deck.update({
          where: { id: own.id },
          data: { ...fields, cards: { create: cards } },
        });
        return data.id;
      }
      const created = await tx.deck.create({
        data: { ...fields, userId: this.userId, cards: { create: cards } },
      });
      return created.publicId;
    });
  }

  async setVisibility(id: string, visibility: DeckVisibility): Promise<boolean> {
    const { count } = await this.db.deck.updateMany({
      where: { publicId: id, userId: this.userId },
      data: { visibility },
    });
    return count > 0;
  }

  async setTargetBracket(id: string, targetBracket: Bracket | null): Promise<boolean> {
    const { count } = await this.db.deck.updateMany({
      where: { publicId: id, userId: this.userId },
      data: { targetBracket },
    });
    return count > 0;
  }

  async rename(id: string, name: string): Promise<boolean> {
    const { count } = await this.db.deck.updateMany({
      where: { publicId: id, userId: this.userId },
      data: { name },
    });
    return count > 0;
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.db.deck.deleteMany({
      where: { publicId: id, userId: this.userId },
    });
    return count > 0;
  }

  async usage(excludeDeckId?: string): Promise<Map<string, CardUsage>> {
    const rows = await this.db.deckCard.findMany({
      where: {
        deck: {
          userId: this.userId,
          ...(excludeDeckId === undefined ? {} : { publicId: { not: excludeDeckId } }),
        },
      },
      select: { oracleId: true, quantity: true, deck: { select: { name: true } } },
    });
    const usage = new Map<string, CardUsage>();
    for (const r of rows) {
      const u = usage.get(r.oracleId) ?? { quantity: 0, decks: [] };
      u.quantity += r.quantity;
      if (!u.decks.includes(r.deck.name)) u.decks.push(r.deck.name);
      usage.set(r.oracleId, u);
    }
    return usage;
  }
}
