import type {
  DeckRepository,
  SaveDeckData,
  SavedDeck,
  SavedDeckSummary,
} from "@/domain/ports/deck-repository";
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

export class PrismaDeckRepository implements DeckRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<SavedDeckSummary[]> {
    const decks = await this.db.deck.findMany({
      orderBy: { updatedAt: "desc" },
      include: { cards: { select: { quantity: true } } },
    });
    return decks.map((d) => ({
      id: d.id,
      name: d.name,
      source: d.source,
      commanderNames: d.commanderNames ? d.commanderNames.split("\n") : [],
      cardCount: d.cards.reduce((n, c) => n + c.quantity, 0),
      updatedAt: d.updatedAt,
    }));
  }

  async get(id: number): Promise<SavedDeck | null> {
    const d = await this.db.deck.findUnique({ where: { id }, include: { cards: true } });
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      source: d.source,
      commanderNames: d.commanderNames ? d.commanderNames.split("\n") : [],
      cardCount: d.cards.reduce((n, c) => n + c.quantity, 0),
      updatedAt: d.updatedAt,
      input: d.input,
      theme: d.theme,
      commanders: d.cards.filter((c) => c.isCommander).map((c) => c.oracleId),
      locked: d.cards.filter((c) => c.locked).map((c) => c.oracleId),
      excluded: parseIds(d.excluded),
    };
  }

  async save(data: SaveDeckData): Promise<number> {
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
      name: data.name,
      input: data.input,
      source: data.source,
      theme: data.theme,
      commanderNames: data.commanders.map((c) => c.name).join("\n"),
      excluded: JSON.stringify(data.excluded),
    };
    return this.db.$transaction(async (tx) => {
      if (data.id !== undefined) {
        await tx.deckCard.deleteMany({ where: { deckId: data.id } });
        await tx.deck.update({
          where: { id: data.id },
          data: { ...fields, cards: { create: cards } },
        });
        return data.id;
      }
      const created = await tx.deck.create({ data: { ...fields, cards: { create: cards } } });
      return created.id;
    });
  }

  async delete(id: number): Promise<boolean> {
    const { count } = await this.db.deck.deleteMany({ where: { id } });
    return count > 0;
  }

  async usage(excludeDeckId?: number): Promise<Map<string, CardUsage>> {
    const rows = await this.db.deckCard.findMany({
      where: excludeDeckId === undefined ? {} : { deckId: { not: excludeDeckId } },
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
