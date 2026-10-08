import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../../tests/helpers/test-db";
import { nameKey } from "@/domain/cards/names";
import { PrismaCardRepository } from "./card-repository";
import { PrismaCollectionRepository } from "./collection-repository";
import type { Db } from "./prisma";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

describe("PrismaCardRepository", () => {
  it("guarda y recupera cartas sin perder datos", async () => {
    const original = fixtureCards().find((c) => c.name === "Grizzled Angler // Grisly Anglerfish");
    const [stored] = await cards.findCardsByOracleIds([original?.oracleId ?? ""]);
    expect(stored).toEqual(original);
  });

  it("busca por clave de nombre completo y de primera cara", async () => {
    const found = await cards.findCardsByNameKeys([
      nameKey("sol ring"),
      nameKey("Grizzled Angler"),
    ]);
    expect(found.map((c) => c.name).sort()).toEqual([
      "Grizzled Angler // Grisly Anglerfish",
      "Sol Ring",
      "Sol Ring", // también el token: el índice en memoria decide cuál prefiere
    ]);
  });

  it("busca impresiones por id y por set+número", async () => {
    const byId = await cards.findPrintingsByIds(["9CF3AF94-B7C8-415C-A5A1-D89967FD0BBA"]);
    expect(byId).toHaveLength(1);
    const bySet = await cards.findPrintingsBySetNumbers([
      { setCode: "C21", collectorNumber: "263" },
      { setCode: "lea", collectorNumber: "270" },
    ]);
    expect(new Set(bySet.map((p) => p.oracleId)).size).toBe(1);
  });

  it("cuenta y vacía el catálogo", async () => {
    expect(await cards.counts()).toEqual({
      cards: fixtureCards().length,
      printings: fixturePrintings().length,
    });
    await cards.clearCatalog();
    expect(await cards.counts()).toEqual({ cards: 0, printings: 0 });
  });
});

describe("PrismaCollectionRepository", () => {
  it("reemplaza la colección y agrega copias por carta", async () => {
    const repo = new PrismaCollectionRepository(db);
    const sol = fixtureCards().find((c) => c.name === "Sol Ring" && c.layout === "normal");
    const row = (name: string, quantity: number, line: number) => ({
      line,
      name,
      setCode: null,
      collectorNumber: null,
      scryfallId: null,
      quantity,
      foil: false,
      language: "en",
      raw: { Name: name },
    });
    await repo.replaceCollection({
      matched: [
        {
          row: row("Sol Ring", 2, 2),
          oracleId: sol?.oracleId ?? "",
          scryfallId: null,
          method: "name",
        },
        {
          row: row("Sol Ring", 1, 3),
          oracleId: sol?.oracleId ?? "",
          scryfallId: null,
          method: "name",
        },
      ],
      unmatched: [row("Carta Inventada", 1, 4)],
    });
    expect(await repo.ownedQuantities()).toEqual(new Map([[sol?.oracleId, 3]]));
    expect(await repo.summary()).toMatchObject({
      rows: 3,
      totalCards: 4,
      uniqueCards: 1,
      unmatchedRows: 1,
    });

    await repo.replaceCollection({ matched: [], unmatched: [] });
    expect((await repo.ownedQuantities()).size).toBe(0);
    expect(await db.collectionEntry.count()).toBe(0);
    expect(await repo.summary()).toMatchObject({ rows: 0, totalCards: 0, importedAt: null });
  });
});
