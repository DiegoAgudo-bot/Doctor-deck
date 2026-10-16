import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_CATALOG_QUERY, type CatalogQuery } from "@/domain/cards/catalog-search";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { makeCard } from "../../../tests/helpers/cards";
import { createTestDb } from "../../../tests/helpers/test-db";
import { PrismaCardRepository } from "./card-repository";
import type { Db } from "./prisma";

let db: Db;
let cleanup: () => Promise<void>;
let repo: PrismaCardRepository;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  repo = new PrismaCardRepository(db);
  await repo.insertCards(fixtureCards());
  await repo.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

const search = async (over: Partial<CatalogQuery>, limit = 50) =>
  (await repo.searchCatalog({ ...EMPTY_CATALOG_QUERY, ...over }, 0, limit)).cards.map(
    (c) => c.name,
  );

describe("searchCatalog", () => {
  it("sin filtros: las más jugadas primero y sin tokens", async () => {
    const { cards, total } = await repo.searchCatalog(EMPTY_CATALOG_QUERY, 0, 3);
    expect(cards.map((c) => c.name)).toEqual([
      "Sol Ring",
      "Mana Crypt",
      "Marang River Regent // Coil and Catch",
    ]);
    expect(total).toBe(22); // 23 cartas menos el token
  });

  it("texto en el nombre, el tipo o el texto de reglas", async () => {
    expect(await search({ text: "octopus" })).toEqual(["Ultros, Obnoxious Octopus"]);
    // Lantern Flare dice "planeswalker" en su texto.
    expect(await search({ text: "Planeswalker", sort: "name" })).toEqual([
      "Lantern Flare",
      "Sorin, Vampire Lord",
      "Teferi, Temporal Archmage",
    ]);
  });

  it("colores: cabe en, exactos o incluye", async () => {
    expect(await search({ colors: ["W", "B"], sort: "name" })).toEqual(
      expect.arrayContaining([
        "Aron, Benalia's Ruin",
        "Sorin, Vampire Lord",
        "Sol Ring",
        "Nyx-Fleece Ram",
      ]),
    );
    expect(await search({ colors: ["W", "B"] })).not.toContain("Satsuki, the Living Lore");
    expect(await search({ colors: ["W", "B"], colorMode: "exact" })).toEqual([
      "Aron, Benalia's Ruin",
    ]);
    expect(await search({ colors: ["W"], colorMode: "includes", sort: "name" })).toEqual([
      "Aron, Benalia's Ruin",
      "Lantern Flare",
      "Nyx-Fleece Ram",
      "Satsuki, the Living Lore",
    ]);
    expect(await search({ colorless: true })).toEqual([
      "Sol Ring",
      "Mana Crypt",
      "Tamiyo's Logbook",
    ]);
  });

  it("tipo, comandante, coste y paginado", async () => {
    expect(await search({ type: "instant", cmc: 5 })).toEqual(["Zimone's Hypothesis"]);
    expect(await search({ commander: true, sort: "name" })).toEqual([
      "Aron, Benalia's Ruin",
      "Satsuki, the Living Lore",
      // "can be your commander"
      "Teferi, Temporal Archmage",
      "Ultros, Obnoxious Octopus",
      "Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom",
    ]);
    expect(await search({ cmc: 7 })).toEqual(["Dig Through Time"]);
    const page2 = await repo.searchCatalog({ ...EMPTY_CATALOG_QUERY, sort: "name" }, 2, 2);
    expect(page2.cards.map((c) => c.name)).toEqual(["Cackling Counterpart", "Dig Through Time"]);
  });

  it("por precio (la impresión más barata), en las dos direcciones y con rango", async () => {
    const priced = (await db.oracleCard.findMany({ where: { minPriceEur: { not: null } } }))
      .map((c) => ({ name: c.name, price: c.minPriceEur ?? 0 }))
      .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    expect(priced.length).toBeGreaterThan(2);
    const desc = await search({ sort: "price" });
    const priceOf = new Map(priced.map((p) => [p.name, p.price]));
    const prices = desc.slice(0, priced.length).map((n) => priceOf.get(n));
    expect(prices).toEqual(priced.map((p) => p.price));
    // Las que no tienen precio, al final en las dos direcciones.
    const asc = await search({ sort: "price", dir: "asc" });
    expect(asc[0]).toBe([...priced].sort((a, b) => a.price - b.price)[0]?.name);
    expect(new Set(asc.slice(priced.length))).toEqual(new Set(desc.slice(priced.length)));
    const top = priced[0];
    if (!top) throw new Error("sin precios");
    expect(await search({ minPrice: top.price })).toEqual(
      priced.filter((p) => p.price >= top.price).map((p) => p.name),
    );
    expect(await search({ maxPrice: top.price - 0.001 })).not.toContain(top.name);
  });
});

describe("searchCatalog: filtros como los de ManaBox", () => {
  let db2: Db;
  let cleanup2: () => Promise<void>;
  let repo2: PrismaCardRepository;
  const elf = makeCard({
    name: "Elvish Archdruid",
    typeLine: "Creature — Elf Druid",
    cmc: 3,
    colorIdentity: ["G"],
    colors: ["G"],
    power: "2",
    toughness: "2",
    keywords: [],
    oracleText: "Other Elf creatures you control get +1/+1.",
  });
  const dragon = makeCard({
    name: "Old Gnawbone",
    typeLine: "Legendary Creature — Dragon",
    cmc: 7,
    colorIdentity: ["G"],
    colors: ["G"],
    power: "7",
    toughness: "7",
    keywords: ["Flying"],
    oracleText: "Flying. Whenever a creature you control deals combat damage, create a Treasure.",
  });
  const hybrid = makeCard({
    name: "Sigil Tracer",
    typeLine: "Creature — Merfolk Wizard",
    cmc: 3,
    // Identidad azul, pero pongamos que la carta fuera incolora: los colores cuentan aparte.
    colorIdentity: ["U"],
    colors: [],
    power: "*",
    toughness: "1+*",
  });
  const printing = (card: { oracleId: string }, id: string, rarity: string, artist: string) => ({
    scryfallId: id,
    oracleId: card.oracleId,
    setCode: rarity === "mythic" ? "cmm" : "lrw",
    collectorNumber: "1",
    lang: "en",
    imageUrl: null,
    rarity,
    artist,
  });

  beforeAll(async () => {
    ({ db: db2, cleanup: cleanup2 } = createTestDb());
    repo2 = new PrismaCardRepository(db2);
    await repo2.insertCards([elf, dragon, hybrid]);
    await repo2.insertPrintings([
      printing(elf, "a1", "rare", "Karl Kopinski"),
      printing(dragon, "a2", "mythic", "Filip Burburan"),
      printing(hybrid, "a3", "common", "Karl Kopinski"),
    ]);
  });
  afterAll(async () => cleanup2());

  const find = async (over: Partial<CatalogQuery>) =>
    (await repo2.searchCatalog({ ...EMPTY_CATALOG_QUERY, sort: "name", ...over }, 0, 50)).cards.map(
      (c) => c.name,
    );

  it("guarda y devuelve colores, fuerza y resistencia, y la rareza y el artista", async () => {
    const [card] = await repo2.findCardsByOracleIds([dragon.oracleId]);
    expect(card).toMatchObject({ colors: ["G"], power: "7", toughness: "7" });
    const [p] = await repo2.findPrintingsByIds(["a2"]);
    expect(p).toMatchObject({ rarity: "mythic", artist: "Filip Burburan" });
  });

  it("texto de reglas, subtipo, habilidad clave y supertipo", async () => {
    expect(await find({ oracle: "treasure" })).toEqual(["Old Gnawbone"]);
    expect(await find({ subtype: "druid" })).toEqual(["Elvish Archdruid"]);
    expect(await find({ keyword: "flying" })).toEqual(["Old Gnawbone"]);
    expect(await find({ supertypes: ["Legendary"] })).toEqual(["Old Gnawbone"]);
  });

  it("rangos de coste, fuerza y resistencia («*» cuenta como 0)", async () => {
    expect(await find({ cmcMin: 3, cmcMax: 4 })).toEqual(["Elvish Archdruid", "Sigil Tracer"]);
    expect(await find({ powerMin: 5 })).toEqual(["Old Gnawbone"]);
    expect(await find({ powerMax: 0 })).toEqual(["Sigil Tracer"]);
    expect(await find({ toughnessMin: 1, toughnessMax: 2 })).toEqual([
      "Elvish Archdruid",
      "Sigil Tracer",
    ]);
  });

  it("rareza, edición y artista de alguna impresión", async () => {
    expect(await find({ rarities: ["rare", "mythic"] })).toEqual([
      "Elvish Archdruid",
      "Old Gnawbone",
    ]);
    expect(await find({ set: "cmm" })).toEqual(["Old Gnawbone"]);
    expect(await find({ artist: "kopinski" })).toEqual(["Elvish Archdruid", "Sigil Tracer"]);
  });

  it("colores de la carta en vez de la identidad", async () => {
    expect(await find({ colors: ["U"], colorMode: "includes" })).toEqual(["Sigil Tracer"]);
    expect(await find({ colors: ["U"], colorMode: "includes", colorBy: "color" })).toEqual([]);
    expect(await find({ colorless: true, colorBy: "color" })).toEqual(["Sigil Tracer"]);
  });
});
