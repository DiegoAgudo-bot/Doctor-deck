import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_CATALOG_QUERY, type CatalogQuery } from "@/domain/cards/catalog-search";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
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
});
