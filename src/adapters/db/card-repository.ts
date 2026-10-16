import { statValue } from "@/domain/cards/attributes";
import { NON_GAME_LAYOUTS } from "@/domain/cards/card-index";
import { nameKey } from "@/domain/cards/names";
import { COLORS, type Card, type Color, type Printing } from "@/domain/cards/types";
import { catalogSortDir, type CatalogQuery } from "@/domain/cards/catalog-search";
import type { CardCatalogWriter, CardRepository } from "@/domain/ports/card-repository";
import type { CardTagWriter } from "@/domain/ports/tagger-source";
import { Prisma, type OracleCard, type Printing as PrintingRow } from "@/generated/prisma/client";
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
  gameChanger: c.gameChanger,
  colors: c.colors ? c.colors.join("") : null,
  power: c.power ?? null,
  toughness: c.toughness ?? null,
  loyalty: c.loyalty ?? null,
  powerValue: statValue(c.power),
  toughnessValue: statValue(c.toughness),
});

const letters = (s: string) => COLORS.filter((c): c is Color => s.includes(c));

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
  colorIdentity: letters(r.colorIdentity),
  legalCommander: r.legalCommander,
  isBasicLand: r.isBasicLand,
  edhrecRank: r.edhrecRank,
  imageUrl: r.imageUrl,
  gameChanger: r.gameChanger,
  ...(r.colors !== null ? { colors: letters(r.colors) } : {}),
  power: r.power,
  toughness: r.toughness,
  loyalty: r.loyalty,
});

const printingFromRow = (r: PrintingRow): Printing => ({
  scryfallId: r.scryfallId,
  oracleId: r.oracleId,
  setCode: r.setCode,
  collectorNumber: r.collectorNumber,
  lang: r.lang,
  imageUrl: r.imageUrl,
  priceEur: r.priceEur,
  priceEurFoil: r.priceEurFoil,
  setName: r.setName,
  releasedAt: r.releasedAt,
  rarity: r.rarity,
  artist: r.artist,
});

/** No salen en el buscador: lo que no es carta de juego (tokens, emblemas, caras sueltas…). */
const NOT_PLAYABLE = [...NON_GAME_LAYOUTS];

export class PrismaCardRepository implements CardRepository, CardCatalogWriter, CardTagWriter {
  constructor(private readonly db: Db) {}

  /**
   * Cartas con sus etiquetas de Tagger (`otags`). Las etiquetas van en otra tabla, sin clave
   * ajena, para que sobrevivan a vaciar y volver a llenar el catálogo en cada `scryfall:sync`.
   */
  private async toCards(rows: readonly OracleCard[]): Promise<Card[]> {
    const tags = new Map<string, string[]>();
    for (const ids of chunks(rows.map((r) => r.oracleId))) {
      const found = await this.db.cardOtag.findMany({ where: { oracleId: { in: ids } } });
      for (const t of found) tags.set(t.oracleId, [...(tags.get(t.oracleId) ?? []), t.tag]);
    }
    return rows.map((r) => {
      const card = fromRow(r);
      const otags = tags.get(r.oracleId);
      return otags ? { ...card, otags: otags.sort() } : card;
    });
  }

  /** Las cartas más jugadas (por puesto de popularidad) para el sitemap: solo el id. */
  async sitemapCards(limit: number): Promise<string[]> {
    const rows = await this.db.oracleCard.findMany({
      where: { edhrecRank: { not: null } },
      orderBy: { edhrecRank: "asc" },
      take: limit,
      select: { oracleId: true },
    });
    return rows.map((r) => r.oracleId);
  }

  async findCardsByOracleIds(oracleIds: readonly string[]) {
    const rows: OracleCard[] = [];
    for (const ids of chunks([...new Set(oracleIds)])) {
      rows.push(...(await this.db.oracleCard.findMany({ where: { oracleId: { in: ids } } })));
    }
    return this.toCards(rows);
  }

  async findCardsByNameKeys(keys: readonly string[]) {
    const out = new Map<string, OracleCard>();
    for (const ks of chunks([...new Set(keys)])) {
      const rows = await this.db.oracleCard.findMany({
        where: { OR: [{ nameKey: { in: ks } }, { frontFaceKey: { in: ks } }] },
      });
      for (const r of rows) out.set(r.oracleId, r);
    }
    return this.toCards([...out.values()]);
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
    return this.toCards([...prefix, ...rest]);
  }

  async searchCatalog(q: CatalogQuery, offset: number, limit: number) {
    const and: Prisma.OracleCardWhereInput[] = [{ layout: { notIn: NOT_PLAYABLE } }];
    if (q.text) {
      const key = nameKey(q.text);
      and.push({
        OR: [
          ...(key ? [{ nameKey: { contains: key } }] : []),
          { typeLine: { contains: q.text } },
          { oracleText: { contains: q.text } },
        ],
      });
    }
    // Por identidad o por los colores de la carta (`colors`, null en datos de antes: no pasan).
    const field = q.colorBy === "color" ? "colors" : "colorIdentity";
    const col = (v: Prisma.StringFilter | string): Prisma.OracleCardWhereInput =>
      field === "colors" ? { colors: v } : { colorIdentity: v };
    if (q.colorless) {
      and.push(col(""));
    } else if (q.colors.length) {
      const picked = new Set(q.colors);
      if (q.colorMode === "exact") {
        and.push(col(COLORS.filter((c) => picked.has(c)).join("")));
      } else if (q.colorMode === "includes") {
        for (const c of picked) and.push(col({ contains: c }));
      } else {
        if (field === "colors") and.push({ colors: { not: null } });
        for (const c of COLORS) if (!picked.has(c)) and.push({ NOT: col({ contains: c }) });
      }
    }
    if (q.type) and.push({ typeLine: { contains: q.type } });
    if (q.commander) {
      and.push({ legalCommander: true });
      and.push({
        OR: [
          {
            AND: [{ typeLine: { contains: "Legendary" } }, { typeLine: { contains: "Creature" } }],
          },
          {
            AND: [
              { typeLine: { contains: "Legendary" } },
              { typeLine: { contains: "Background" } },
            ],
          },
          { oracleText: { contains: "can be your commander" } },
        ],
      });
    }
    if (q.gameChanger) and.push({ gameChanger: true });
    if (q.cmc !== null) and.push({ cmc: q.cmc >= 7 ? { gte: 7 } : q.cmc });
    if (q.minPrice !== null) and.push({ minPriceEur: { gte: q.minPrice } });
    if (q.maxPrice !== null) and.push({ minPriceEur: { lte: q.maxPrice } });
    if (q.oracle) and.push({ oracleText: { contains: q.oracle } });
    // Los subtipos van tras la raya: "— Elf" o "Elf" más adelante ("— Elf Druid").
    if (q.subtype) and.push({ typeLine: { contains: "—" } }, { typeLine: { contains: q.subtype } });
    if (q.keyword) and.push({ keywords: { contains: `"${q.keyword.replace(/"/g, "")}` } });
    for (const t of q.supertypes) and.push({ typeLine: { contains: t } });
    const range = (min: number | null, max: number | null) => ({
      ...(min !== null ? { gte: min } : {}),
      ...(max !== null ? { lte: max } : {}),
    });
    if (q.cmcMin !== null || q.cmcMax !== null) and.push({ cmc: range(q.cmcMin, q.cmcMax) });
    if (q.powerMin !== null || q.powerMax !== null) {
      and.push({ powerValue: range(q.powerMin, q.powerMax) });
    }
    if (q.toughnessMin !== null || q.toughnessMax !== null) {
      and.push({ toughnessValue: range(q.toughnessMin, q.toughnessMax) });
    }
    if (q.rarities.length || q.set || q.artist) {
      and.push({
        printings: {
          some: {
            ...(q.rarities.length ? { rarity: { in: q.rarities } } : {}),
            ...(q.set ? { setCode: q.set } : {}),
            ...(q.artist ? { artist: { contains: q.artist } } : {}),
          },
        },
      });
    }
    const where: Prisma.OracleCardWhereInput = { AND: and };
    const dir = catalogSortDir(q);
    // "Más jugadas" de más a menos = rango de EDHREC ascendente; las que no tienen, siempre al final.
    const rank = {
      edhrecRank: { sort: q.sort === "popular" && dir === "asc" ? "desc" : "asc", nulls: "last" },
    } as const;
    const orderBy: Prisma.OracleCardOrderByWithRelationInput[] =
      q.sort === "name"
        ? [{ name: dir }]
        : q.sort === "cmc"
          ? [{ cmc: dir }, rank, { name: "asc" }]
          : q.sort === "price"
            ? [{ minPriceEur: { sort: dir, nulls: "last" } }, rank, { name: "asc" }]
            : [rank, { name: "asc" }];
    const [rows, total] = await Promise.all([
      this.db.oracleCard.findMany({ where, orderBy, skip: offset, take: limit }),
      this.db.oracleCard.count({ where }),
    ]);
    return { cards: await this.toCards(rows), total };
  }

  async findPrintingsByIds(scryfallIds: readonly string[]) {
    const out: Printing[] = [];
    for (const ids of chunks([...new Set(scryfallIds.map((i) => i.toLowerCase()))])) {
      const rows = await this.db.printing.findMany({ where: { scryfallId: { in: ids } } });
      out.push(...rows.map(printingFromRow));
    }
    return out;
  }

  async nameEntries() {
    const rows = await this.db.oracleCard.findMany({
      where: { layout: { notIn: NOT_PLAYABLE } },
      select: { oracleId: true, name: true, edhrecRank: true },
    });
    // Cada cara por separado: en la carta solo se lee la que está boca arriba.
    return rows.flatMap((r) =>
      r.name
        .split(" // ")
        .map((face) => ({ oracleId: r.oracleId, name: face.trim(), rank: r.edhrecRank })),
    );
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
      // Ya calculado al guardar las impresiones (`minPriceEur`): sin agrupar `Printing` cada vez.
      const rows = await this.db.oracleCard.findMany({
        where: { oracleId: { in: ids }, minPriceEur: { not: null } },
        select: { oracleId: true, minPriceEur: true },
      });
      for (const r of rows) if (r.minPriceEur !== null) prices.set(r.oracleId, r.minPriceEur);
    }
    return prices;
  }

  async findPrintingsOf(oracleId: string) {
    const rows = await this.db.printing.findMany({
      where: { oracleId },
      orderBy: [{ releasedAt: "desc" }, { setCode: "asc" }, { collectorNumber: "asc" }],
    });
    return rows.map(printingFromRow);
  }

  async findBasicLandIds(oracleIds: readonly string[]) {
    const basics = new Set<string>();
    for (const ids of chunks([...new Set(oracleIds)])) {
      const rows = await this.db.oracleCard.findMany({
        where: { oracleId: { in: ids }, isBasicLand: true },
        select: { oracleId: true },
      });
      for (const r of rows) basics.add(r.oracleId);
    }
    return basics;
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

  async replaceTag(tag: string, oracleIds: readonly string[], syncedAt: Date) {
    const ids = [...new Set(oracleIds)];
    await this.db.$transaction(async (tx) => {
      await tx.cardOtag.deleteMany({ where: { tag } });
      for (const batch of chunks(ids)) {
        await tx.cardOtag.createMany({ data: batch.map((oracleId) => ({ oracleId, tag })) });
      }
      const sync = { syncedAt, cards: ids.length };
      await tx.otagSync.upsert({ where: { tag }, create: { tag, ...sync }, update: sync });
    });
  }

  async tagSyncs() {
    const rows = await this.db.otagSync.findMany();
    return new Map(rows.map((r) => [r.tag, { syncedAt: r.syncedAt, cards: r.cards }]));
  }

  async insertPrintings(printings: readonly Printing[]) {
    for (const batch of chunks(printings)) {
      await this.db.printing.createMany({
        data: batch.map((p) => ({ ...p, scryfallId: p.scryfallId.toLowerCase() })),
      });
      await this.refreshMinPrices([...new Set(batch.map((p) => p.oracleId))]);
    }
  }

  /** `OracleCard.minPriceEur` = la impresión más barata (para ordenar el buscador por precio). */
  private async refreshMinPrices(oracleIds: readonly string[]) {
    if (oracleIds.length === 0) return;
    await this.db.$executeRaw`
      UPDATE "OracleCard" SET "minPriceEur" = (
        SELECT MIN("priceEur") FROM "Printing" WHERE "Printing"."oracleId" = "OracleCard"."oracleId"
      ) WHERE "oracleId" IN (${Prisma.join(oracleIds)})`;
  }
}
