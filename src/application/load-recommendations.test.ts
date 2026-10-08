import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { HttpClient } from "@/adapters/http/http-client";
import { MemoryResponseCache } from "@/adapters/http/memory-cache";
import { fixtureCards, fixturePrintings, readFixture } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../tests/helpers/test-db";
import { loadRecommendations } from "./load-recommendations";

let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

beforeAll(async () => {
  const t = createTestDb();
  cleanup = t.cleanup;
  cards = new PrismaCardRepository(t.db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

const source = new EdhrecClient({
  http: new HttpClient({
    userAgent: "test",
    minIntervalMs: 0,
    clock: { now: () => 0, sleep: async () => undefined },
    fetchFn: async () => new Response(readFixture("edhrec/teferi-temporal-archmage.json")),
  }),
  cache: new MemoryResponseCache(),
  ttlMs: 1000,
});

describe("loadRecommendations", () => {
  it("resuelve los nombres de EDHREC a cartas del catálogo", async () => {
    const recs = await loadRecommendations(
      { commanders: ["Teferi, Temporal Archmage"] },
      { source, cards },
    );
    const dig = recs.cards.find((r) => r.name === "Dig Through Time");
    expect(dig?.card.typeLine).toBe("Instant");
    expect(dig?.synergy).toBe(0.31);

    // Cartas de dos caras con el nombre completo
    expect(recs.cards.some((r) => r.card.name === "Grizzled Angler // Grisly Anglerfish")).toBe(
      true,
    );
    // Sol Ring es la carta, no el token homónimo
    expect(recs.cards.find((r) => r.name === "Sol Ring")?.card.layout).toBe("normal");
    // Reliquary Tower no está en el catálogo de prueba
    expect(recs.unresolved).toEqual(["Reliquary Tower"]);
    expect(recs.totalDecks).toBe(4000);
  });
});
