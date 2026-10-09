import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import type { Db } from "@/adapters/db/prisma";
import { archidektDeckSource } from "@/adapters/deck-sources/archidekt";
import { moxfieldDeckSource } from "@/adapters/deck-sources/moxfield";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { HttpClient } from "@/adapters/http/http-client";
import { readJsonArray } from "@/adapters/scryfall/bulk";
import { safeMappers } from "@/adapters/scryfall/mapping";
import { FIXTURES, readFixture } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { EmptyCatalogError, importCollection } from "./import-collection";
import { loadDeck, UnsupportedDeckInputError } from "./load-deck";
import { syncScryfallCatalog } from "./sync-scryfall";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
let collection: PrismaCollectionRepository;

const bulk = {
  oracleCards: () => readJsonArray(path.join(FIXTURES, "scryfall/oracle_cards.sample.json")),
  defaultCards: () => readJsonArray(path.join(FIXTURES, "scryfall/default_cards.sample.json")),
};

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  collection = new PrismaCollectionRepository(db, await createTestUser(db));
});
afterAll(async () => cleanup());

describe("importCollection sin catálogo", () => {
  it("avisa de que hay que sincronizar Scryfall", async () => {
    await expect(
      importCollection("Name,Quantity\nSol Ring,1", { cards, collection }),
    ).rejects.toBeInstanceOf(EmptyCatalogError);
  });
});

describe("syncScryfallCatalog", () => {
  it("vuelca los bulk y descarta lo inválido", async () => {
    const progress: string[] = [];
    const result = await syncScryfallCatalog(
      {
        oracleCards: bulk.oracleCards,
        // Añadimos basura y una impresión de una carta desconocida
        async *defaultCards() {
          yield* bulk.defaultCards();
          yield { foo: "bar" };
          yield { ...(await firstDefault()), id: "zzz", oracle_id: "desconocido" };
        },
      },
      safeMappers,
      cards,
      (m) => progress.push(m),
    );
    expect(result).toEqual({ cards: 23, printings: 23, skipped: 2 });
    expect(await cards.counts()).toEqual({ cards: 23, printings: 23 });
  });

  it("es idempotente: volver a sincronizar reemplaza el catálogo", async () => {
    await syncScryfallCatalog(bulk, safeMappers, cards);
    expect(await cards.counts()).toEqual({ cards: 23, printings: 23 });
  });
});

describe("importCollection", () => {
  it("importa el recorte del CSV real y resume el resultado", async () => {
    const csv =
      readFixture("manabox_sample.csv") +
      "Carta Inventada,XXX,Nada,1,normal,common,1,0,,0,false,false,false,near_mint,en,false,EUR,x\n" +
      ",XXX,Nada,1,normal,common,1,0,,0,false,false,false,near_mint,en,false,EUR,x\n";
    const summary = await importCollection(csv, { cards, collection });
    expect(summary).toMatchObject({
      rows: 17,
      totalCards: 19,
      uniqueCards: 16,
      matchedRows: 16,
      matchedBy: { scryfallId: 14, setNumber: 1, name: 1 },
    });
    expect(summary.unmatched.map((r) => r.name)).toEqual(["Carta Inventada"]);
    expect(summary.errors.map((e) => e.line)).toEqual([19]);
    expect([...(await collection.ownedQuantities()).values()].reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe("loadDeck", () => {
  it("resuelve una lista pegada contra el catálogo", async () => {
    const loaded = await loadDeck(
      [
        "Commander",
        "1 Teferi, Temporal Archmage",
        "",
        "Deck",
        "1 Sol Ring (C21) 263",
        "1 Dig Through Time",
        "1 Grizzled Angler",
        "1 Mana Crypt",
        "1 Satsuki, the Living Lore",
        "30 Island",
        "1 Carta Inventada",
        "Sideboard",
        "1 Body of Knowledge",
      ].join("\n"),
      { sources: [textDeckSource], cards },
    );
    expect(loaded.source).toBe("text");
    expect(loaded.deck.commanders.map((c) => c.name)).toEqual(["Teferi, Temporal Archmage"]);
    expect(loaded.deck.cards.map((c) => c.card.name)).toEqual([
      "Sol Ring",
      "Dig Through Time",
      "Grizzled Angler // Grisly Anglerfish",
      "Mana Crypt",
      "Satsuki, the Living Lore",
      "Island",
    ]);
    expect(loaded.deck.unresolved.map((e) => e.name)).toEqual(["Carta Inventada"]);
    expect(loaded.skipped).toHaveLength(1);
    expect(loaded.issues.map((i) => i.kind).sort()).toEqual(["colorIdentity", "notLegal", "size"]);
  });

  it("prefiere la carta jugable al token con el mismo nombre", async () => {
    const loaded = await loadDeck("1 Sol Ring", { sources: [textDeckSource], cards });
    expect(loaded.deck.cards[0]?.card.layout).toBe("normal");
  });

  it("falla si ninguna fuente acepta la entrada", async () => {
    await expect(
      loadDeck("https://archidekt.com/decks/1", { sources: [textDeckSource], cards }),
    ).rejects.toBeInstanceOf(UnsupportedDeckInputError);
  });

  it.each([
    [
      "https://archidekt.com/decks/123456/teferi",
      "deck-sources/archidekt.json",
      "archidekt",
      "Teferi control",
    ],
    [
      "https://moxfield.com/decks/AbC123_-x",
      "deck-sources/moxfield-v3.json",
      "moxfield",
      "Teferi (Moxfield)",
    ],
  ])("carga un mazo desde %s", async (link, fixture, source, name) => {
    const http = new HttpClient({
      userAgent: "test",
      minIntervalMs: 0,
      clock: { now: () => 0, sleep: async () => undefined },
      fetchFn: async () => new Response(readFixture(fixture)),
    });
    const loaded = await loadDeck(link, {
      sources: [archidektDeckSource(http), moxfieldDeckSource(http), textDeckSource],
      cards,
    });
    expect(loaded.source).toBe(source);
    expect(loaded.deckName).toBe(name);
    expect(loaded.deck.commanderSource).toBe("marked");
    expect(loaded.deck.commanders.map((c) => c.name)).toEqual(["Teferi, Temporal Archmage"]);
    const names = loaded.deck.cards.map((c) => c.card.name);
    expect(names).toEqual(expect.arrayContaining(["Sol Ring", "Dig Through Time", "Island"]));
    expect(names).not.toContain("Body of Knowledge"); // maybeboard / sideboard
  });
});

async function firstDefault(): Promise<Record<string, unknown>> {
  for await (const x of bulk.defaultCards()) return x as Record<string, unknown>;
  throw new Error("fixture vacío");
}
