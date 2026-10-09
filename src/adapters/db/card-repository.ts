import { NON_GAME_LAYOUTS } from "@/domain/cards/card-index";
import { nameKey } from "@/domain/cards/names";
import { COLORS, type Card, type Color, type Printing } from "@/domain/cards/types";
import type { CardCatalogWriter, CardRepository } from "@/domain/ports/card-repository";
import type { OracleCard, Printing as PrintingRow } from "@/generated/prisma/client";
import type { Db } from "./prisma";

/** SQLite admite ~32k parámetros por consulta; troceamos los IN para ir sobrados. */
const CHUNK = 500;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const toRow = (c: Card) => ({
  oracleId: c.oracleId,
  name: c.name,
  nameKey: nameKey(c.name),
  frontFaceName: c.frontFaceName,
  frontFaceKey: c.frontFaceName ? nameKey(c.frontFaceName) : null,
  layout: c.layout,
  manaCost: c.manaCost,
  cmc: c.cmc,
  typeLine: c.typeLine,
  oracleText: c.oracleText,
  keywords: JSON.stringify(c.keywords),
  colorIdentity: c.colorIdentity.join(""),
  legalCommander: c.legalCommander,
  isBasicLand: c.isBasicLand,
  edhrecRank: c.edhrecRank,
  imageUrl: c.imageUrl,
});

const fromRow = (r: OracleCard): Card => ({
  oracleId: r.oracleId,
  name: r.name,
  frontFaceName: r.frontFaceName,
  layout: r.layout,
  manaCost: r.manaCost,
  cmc: r.cmc,
  typeLine: r.typeLine,
  oracleText: r.oracleText,
  keywords: JSON.parse(r.keywords) as string[],
  colorIdentity: COLORS.filter((c): c is Color => r.colorIdentity.includes(c)),
  legalCommander: r.legalCommander,
  isBasicLand: r.isBasicLand,
  edhrecRank: r.edhrecRank,
  imageUrl: r.imageUrl,
});

const printingFromRow = (r: PrintingRow): Printing => ({
  scryfallId: r.scryfallId,
  oracleId: r.oracleId,
  setCode: r.setCode,
  collectorNumber: r.collectorNumber,
  lang: r.lang,
  imageUrl: r.imageUrl,
  priceEur: r.priceEur,
});

/** No salen en el buscador: lo que no es carta de juego (tokens, emblemas, caras sueltas…). */
const NOT_PLAYABLE = [...NON_GAME_LAYOUTS];

export class PrismaCardRepository implements CardRepository, CardCatalogWriter {
  constructor(private readonly db: Db) {}

  async findCardsByOracleIds(oracleIds: readonly string[]) {
    const out: Card[] = [];
    for (const ids of chunks([...new Set(oracleIds)])) {
      const rows = await this.db.oracleCard.findMany({ where: { oracleId: { in: ids } } });
      out.push(...rows.map(fromRow));
    }
    return out;
  }

  async findCardsByNameKeys(keys: readonly string[]) {
    const out = new Map<string, Card>();
    for (const ks of chunks([...new Set(keys)])) {
      const rows = await this.db.oracleCard.findMany({
        where: { OR: [{ nameKey: { in: ks } }, { frontFaceKey: { in: ks } }] },
      });
      for (const r of rows) out.set(r.oracleId, fromRow(r));
    }
    return [...out.values()];
  }

  async searchByName(query: string, limit: number) {
    const key = nameKey(query);
    if (!key) return [];
    const where = (match: object) => ({
      AND: [match, { layout: { notIn: NOT_PLAYABLE } }],
    });
    const order = [
      { edhrecRank: { sort: "asc" as const, nulls: "last" as const } },
      { name: "asc" as const },
    ];
    const prefix = await this.db.oracleCard.findMany({
      // Empieza así el nombre o alguna de sus palabras ("bolt" → Lightning Bolt).
      where: where({
        OR: [
          { nameKey: { startsWith: key } },
          { frontFaceKey: { startsWith: key } },
          { nameKey: { contains: ` ${key}` } },
        ],
      }),
      orderBy: order,
      take: limit,
    });
    const rest =
      prefix.length < limit
        ? await this.db.oracleCard.findMany({
            where: where({
              nameKey: { contains: key },
              oracleId: { notIn: prefix.map((r) => r.oracleId) },
            }),
            orderBy: order,
            take: limit - prefix.length,
          })
        : [];
    return [...prefix, ...rest].map(fromRow);
  }

  async findPrintingsByIds(scryfallIds: readonly string[]) {
    const out: Printing[] = [];
    for (const ids of chunks([...new Set(scryfallIds.map((i) => i.toLowerCase()))])) {
      const rows = await this.db.printing.findMany({ where: { scryfallId: { in: ids } } });
      out.push(...rows.map(printingFromRow));
    }
    return out;
  }

  async findPrintingsBySetNumbers(pairs: readonly { setCode: string; collectorNumber: string }[]) {
    const out: Printing[] = [];
    for (const ps of chunks(pairs, 200)) {
      const rows = await this.db.printing.findMany({
        where: {
          OR: ps.map((p) => ({
            setCode: p.setCode.toLowerCase(),
            collectorNumber: p.collectorNumber,
          })),
        },
      });
      out.push(...rows.map(printingFromRow));
    }
    return out;
  }

  async findMinPrices(oracleIds: readonly string[]) {
    const prices = new Map<string, number>();
    for (const ids of chunks([...new Set(oracleIds)])) {
      const rows = await this.db.printing.groupBy({
        by: ["oracleId"],
        where: { oracleId: { in: ids }, priceEur: { not: null } },
        _min: { priceEur: true },
      });
      for (const r of rows) if (r._min.priceEur !== null) prices.set(r.oracleId, r._min.priceEur);
    }
    return prices;
  }

  async counts() {
    const [cards, printings] = await Promise.all([
      this.db.oracleCard.count(),
      this.db.printing.count(),
    ]);
    return { cards, printings };
  }

  async clearCatalog() {
    await this.db.$transaction([this.db.printing.deleteMany(), this.db.oracleCard.deleteMany()]);
  }

  async insertCards(cards: readonly Card[]) {
    for (const batch of chunks(cards)) {
      await this.db.oracleCard.createMany({ data: batch.map(toRow) });
    }
  }

  async insertPrintings(printings: readonly Printing[]) {
    for (const batch of chunks(printings)) {
      await this.db.printing.createMany({
        data: batch.map((p) => ({ ...p, scryfallId: p.scryfallId.toLowerCase() })),
      });
    }
  }
}
