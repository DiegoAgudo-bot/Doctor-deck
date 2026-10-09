import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { HttpClient } from "@/adapters/http/http-client";
import { MemoryResponseCache } from "@/adapters/http/memory-cache";
import { fixtureCards, fixturePrintings, readFixture } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { commanderInfo, InvalidCommanderError, newDeckFromCommander } from "./new-deck";
import { saveDeck } from "./save-deck";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
let edhrec: EdhrecClient;
const requested: string[] = [];
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")?.oracleId ?? "";

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "u1");
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  const pages: Record<string, string> = {
    "/commanders/teferi-temporal-archmage.json": readFixture(
      "edhrec/teferi-temporal-archmage.json",
    ),
    "/average-decks/teferi-temporal-archmage.json": readFixture("edhrec/average-deck-teferi.json"),
    "/average-decks/teferi-temporal-archmage/superfriends.json": readFixture(
      "edhrec/average-deck-teferi.json",
    ),
  };
  edhrec = new EdhrecClient({
    http: new HttpClient({
      userAgent: "test",
      minIntervalMs: 0,
      clock: { now: () => 0, sleep: async () => undefined },
      fetchFn: async (url) => {
        requested.push(url);
        const body = pages[url.replace("https://json.edhrec.com/pages", "")];
        return body ? new Response(body) : new Response("", { status: 404 });
      },
    }),
    cache: new MemoryResponseCache(),
    ttlMs: 3_600_000,
  });
});
afterAll(async () => cleanup());

const deps = () => ({ cards, recommendations: edhrec, averageDecks: edhrec });

describe("commanderInfo", () => {
  it("da los temas de más a menos jugados y el nombre propuesto", async () => {
    const info = await commanderInfo([id("Teferi, Temporal Archmage")], deps());
    expect(info.themes.map((t) => t.slug)).toEqual(["control", "spellslinger", "superfriends"]);
    expect(info.suggestedName).toBe("Mono azul - Control y Hechizos");
  });

  it("rechaza cartas que no pueden ser comandante", async () => {
    await expect(commanderInfo([id("Sol Ring")], deps())).rejects.toBeInstanceOf(
      InvalidCommanderError,
    );
    await expect(commanderInfo(["no-existe"], deps())).rejects.toBeInstanceOf(
      InvalidCommanderError,
    );
  });
});

describe("newDeckFromCommander", () => {
  it("monta el mazo medio de EDHREC y lo nombra por colores y temas", async () => {
    const deck = await newDeckFromCommander(
      { commanderIds: [id("Teferi, Temporal Archmage")], mode: "average" },
      deps(),
    );
    expect(deck.name).toBe("Mono azul - Control y Hechizos");
    expect(deck.cardCount).toBe(36);
    expect(deck.input).toMatch(/^Commander\n1 Teferi, Temporal Archmage\n\nDeck\n/);
    expect(deck.input).toContain("30 Island");

    // Se guarda como cualquier otro mazo; lo que no está en el catálogo queda fuera.
    const repo = new PrismaDeckRepository(db, "u1");
    const saved = await saveDeck(
      { input: deck.input, name: deck.name },
      { sources: [textDeckSource], cards, decks: repo },
    );
    const stored = await repo.get(saved.id);
    expect(stored).toMatchObject({ name: "Mono azul - Control y Hechizos", cardCount: 36 });
  });

  it("con tema: su mazo medio y el tema en el nombre", async () => {
    const deck = await newDeckFromCommander(
      { commanderIds: [id("Teferi, Temporal Archmage")], mode: "average", theme: "superfriends" },
      deps(),
    );
    expect(deck.name).toBe("Mono azul - Planeswalkers");
    expect(deck.theme).toBe("superfriends");
    expect(requested).toContain(
      "https://json.edhrec.com/pages/average-decks/teferi-temporal-archmage/superfriends.json",
    );
  });

  it("desde cero: solo el comandante", async () => {
    const deck = await newDeckFromCommander(
      { commanderIds: [id("Teferi, Temporal Archmage")], mode: "empty" },
      deps(),
    );
    expect(deck).toMatchObject({ name: "Mono azul - Teferi", cardCount: 0 });
    expect(deck.input).toBe("Commander\n1 Teferi, Temporal Archmage\n\nDeck\n");
  });
});
