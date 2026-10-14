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
import { withLoans } from "@/domain/collection/loans";
import type { CardUsage } from "@/domain/suggestions/engine";
import type { Db } from "./prisma";
import { MAX_DECK_VERSIONS, VERSION_COALESCE_MS, type VersionCard } from "@/domain/deck/versions";

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
    inWishlist: d.inWishlist,
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

  /**
   * Lo que necesita el sitemap: id, fecha y dueño de los mazos públicos, sin cartas (con cartas
   * eran cientos de miles de filas solo para sacar URLs).
   */
  async sitemapEntries(limit: number) {
    const rows = await this.db.deck.findMany({
      where: { visibility: "public", user: { username: { not: null } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { publicId: true, updatedAt: true, user: { select: { username: true } } },
    });
    return rows.flatMap((r) =>
      r.user?.username
        ? [{ id: r.publicId, updatedAt: r.updatedAt, username: r.user.username }]
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
      inWishlist: d.inWishlist,
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
        scryfallId: c.scryfallId ?? null,
      })),
      ...data.cards.map((c) => ({
        oracleId: c.oracleId,
        quantity: c.quantity,
        isCommander: false,
        locked: locked.has(c.oracleId),
        scryfallId: c.scryfallId ?? null,
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
        await keepVersion(tx, own.id, data.input);
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

  async versions(id: string) {
    const deck = await this.db.deck.findFirst({
      where: { publicId: id, userId: this.userId },
      select: {
        cards: { select: { oracleId: true, quantity: true, isCommander: true } },
        versions: { orderBy: { createdAt: "desc" }, take: MAX_DECK_VERSIONS },
      },
    });
    if (!deck) return null;
    return {
      current: deck.cards.map((c): VersionCard => [c.oracleId, c.quantity, c.isCommander]),
      versions: deck.versions.map((v) => ({
        id: v.publicId,
        createdAt: v.createdAt,
        cards: parseVersionCards(v.cards),
      })),
    };
  }

  async version(id: string, versionId: string) {
    const v = await this.db.deckVersion.findFirst({
      where: { publicId: versionId, deck: { publicId: id, userId: this.userId } },
    });
    if (!v) return null;
    return {
      input: v.input,
      commanders: parseVersionCards(v.cards)
        .filter(([, , commander]) => commander)
        .map(([oracleId]) => oracleId),
    };
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

  async setInWishlist(id: string, inWishlist: boolean): Promise<boolean> {
    const { count } = await this.db.deck.updateMany({
      where: { publicId: id, userId: this.userId },
      data: { inWishlist },
    });
    return count > 0;
  }

  async wishlistDeckCards(): Promise<Map<string, number>> {
    const rows = await this.db.deckCard.groupBy({
      by: ["oracleId"],
      where: { deck: { userId: this.userId, inWishlist: true } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.oracleId, r._sum.quantity ?? 0]));
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

  /** Incluye las copias prestadas sin devolver ("Prestada a @ana"): siguen sin estar libres. */
  async usage(excludeDeckId?: string): Promise<Map<string, CardUsage>> {
    const loans = await this.db.loan.findMany({
      where: { lenderId: this.userId, returnedAt: null },
      select: {
        oracleId: true,
        quantity: true,
        borrowerName: true,
        borrower: { select: { username: true, name: true } },
      },
    });
    const rows = await this.db.deckCard.findMany({
      where: {
        deck: {
          userId: this.userId,
          ...(excludeDeckId === undefined ? {} : { publicId: { not: excludeDeckId } }),
        },
      },
      select: { oracleId: true, quantity: true, deck: { select: { name: true, publicId: true } } },
    });
    const usage = new Map<string, CardUsage>();
    for (const r of rows) {
      const u = usage.get(r.oracleId) ?? { quantity: 0, decks: [], deckIds: [] };
      u.quantity += r.quantity;
      if (!u.deckIds?.includes(r.deck.publicId)) {
        u.decks.push(r.deck.name);
        u.deckIds?.push(r.deck.publicId);
      }
      usage.set(r.oracleId, u);
    }
    return withLoans(
      usage,
      loans.map((l) => ({
        oracleId: l.oracleId,
        quantity: l.quantity,
        to: l.borrower
          ? l.borrower.username
            ? `@${l.borrower.username}`
            : l.borrower.name
          : (l.borrowerName ?? "alguien"),
      })),
    );
  }
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

const parseVersionCards = (json: string): VersionCard[] => {
  try {
    const rows = JSON.parse(json) as unknown;
    return Array.isArray(rows)
      ? rows.flatMap((r) =>
          Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "number"
            ? [[r[0], r[1], r[2] === true] as VersionCard]
            : [],
        )
      : [];
  } catch {
    return [];
  }
};

/**
 * Antes de cambiar la lista de un mazo, guarda la de ahora como versión (si cambia de verdad y la
 * última versión no es de hace menos de `VERSION_COALESCE_MS`: los cambios seguidos cuentan como
 * uno) y deja solo las `MAX_DECK_VERSIONS` más nuevas.
 */
async function keepVersion(tx: Tx, deckId: number, nextInput: string) {
  const deck = await tx.deck.findUnique({
    where: { id: deckId },
    select: {
      input: true,
      cards: { select: { oracleId: true, quantity: true, isCommander: true } },
      versions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  if (!deck || deck.input === nextInput || deck.cards.length === 0) return;
  const last = deck.versions[0]?.createdAt;
  if (last && Date.now() - last.getTime() < VERSION_COALESCE_MS) return;
  await tx.deckVersion.create({
    data: {
      deckId,
      input: deck.input,
      cards: JSON.stringify(deck.cards.map((c) => [c.oracleId, c.quantity, c.isCommander])),
    },
  });
  const old = await tx.deckVersion.findMany({
    where: { deckId },
    orderBy: { createdAt: "desc" },
    skip: MAX_DECK_VERSIONS,
    select: { id: true },
  });
  if (old.length > 0)
    await tx.deckVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
