import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { HttpClient } from "@/adapters/http/http-client";
import { MemoryResponseCache } from "@/adapters/http/memory-cache";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { mergeEngineConfig } from "@/domain/suggestions/config";
import { fixtureCards, fixturePrintings, readFixture } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../tests/helpers/test-db";
import { analyzeDeck, type AnalyzeDeckDeps } from "./analyze-deck";
import { importCollection } from "./import-collection";

let cleanup: () => Promise<void>;
let deps: AnalyzeDeckDeps;
const requested: string[] = [];

beforeAll(async () => {
  const t = createTestDb();
  cleanup = t.cleanup;
  const cards = new PrismaCardRepository(t.db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  const collection = new PrismaCollectionRepository(t.db);
  // Mi colección: el recorte real del CSV (Dig Through Time, Body of Knowledge, Cackling Counterpart…)
  await importCollection(readFixture("manabox_sample.csv"), { cards, collection });

  const pages: Record<string, string> = {
    "/commanders/teferi-temporal-archmage.json": readFixture(
      "edhrec/teferi-temporal-archmage.json",
    ),
    "/commanders/teferi-temporal-archmage/control.json": readFixture(
      "edhrec/teferi-temporal-archmage-control.json",
    ),
  };
  const recommendations = new EdhrecClient({
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
    ttlMs: 1000,
  });

  deps = {
    sources: [textDeckSource],
    cards,
    collection,
    recommendations,
    classifier: new HeuristicRoleClassifier(),
    // Sin mínimos para que el mazo de prueba (pequeño) no bloquee cambios
    config: mergeEngineConfig({ minimums: { land: 0, ramp: 0, draw: 0, removal: 0, wipe: 0 } }),
  };
});
afterAll(async () => cleanup());

const DECK = [
  "Commander",
  "1 Teferi, Temporal Archmage",
  "Deck",
  "1 Sol Ring",
  "1 Ichor Synthesizer", // en EDHREC con −1 synergy y 3 % inclusión
  "1 Ultros, Obnoxious Octopus", // no aparece en EDHREC
  "1 Tamiyo's Logbook", // en EDHREC con 2 % inclusión
  "1 Thundertrap Trainer", // 10 % inclusión, +12 synergy
  "20 Island",
].join("\n");

describe("analyzeDeck (de extremo a extremo con fixtures)", () => {
  it("propone cambios usando solo cartas de mi colección", async () => {
    const result = await analyzeDeck({ input: DECK }, deps);
    if (result.status !== "ok") throw new Error("se esperaba status ok");

    expect(result.edhrec).toMatchObject({
      commanderSlug: "teferi-temporal-archmage",
      totalDecks: 4000,
      stale: false,
    });
    expect(result.edhrec.unresolved).toEqual(["Reliquary Tower"]);

    const { swaps, addCandidates, cutCandidates } = result.suggestions;
    // Candidatos a entrar: recomendados, en mi colección y fuera del mazo
    expect(addCandidates.map((c) => c.card.name)).toEqual([
      "Dig Through Time",
      "Body of Knowledge",
      "Cackling Counterpart",
      "Marang River Regent // Coil and Catch",
      "Zimone's Hypothesis",
      "Grizzled Angler // Grisly Anglerfish",
    ]);
    // Primero la que no está en EDHREC; Sol Ring nunca es la primera en salir
    expect(cutCandidates[0]?.card.name).toBe("Ultros, Obnoxious Octopus");
    expect(cutCandidates.map((c) => c.card.name)).not.toContain("Island");

    expect(swaps.length).toBeGreaterThanOrEqual(3);
    for (const s of swaps) {
      expect(s.reason).toMatch(/^Sustituye a .+ por .+\. La tienes en tu colección/);
      expect(s.in.owned).toBeGreaterThan(0);
    }
    const first = swaps[0];
    expect(first?.in.card.name).toBe("Dig Through Time");
    expect(first?.reason).toContain("Dig Through Time (robo, 38 % inclusión, +31 synergy)");

    expect(result.curve[1]).toBe(1); // Sol Ring
    expect(result.issues.map((i) => i.kind)).toContain("size");
  });

  it("respeta las cartas bloqueadas", async () => {
    const free = await analyzeDeck({ input: DECK }, deps);
    if (free.status !== "ok") throw new Error();
    const firstOut = free.suggestions.swaps[0]?.out.card;
    if (!firstOut) throw new Error();

    const locked = await analyzeDeck({ input: DECK, locked: [firstOut.oracleId] }, deps);
    if (locked.status !== "ok") throw new Error();
    expect(locked.suggestions.swaps.map((s) => s.out.card.oracleId)).not.toContain(
      firstOut.oracleId,
    );
  });

  it("usa la página del tema si se indica", async () => {
    const result = await analyzeDeck({ input: DECK, theme: "control" }, deps);
    if (result.status !== "ok") throw new Error();
    expect(requested.at(-1)).toMatch(/teferi-temporal-archmage\/control\.json$/);
    expect(result.edhrec.totalDecks).toBe(812);
  });

  it("pide elegir comandante si no se puede detectar, y acepta la elección", async () => {
    const ambiguous = [
      "1 Teferi, Temporal Archmage",
      "1 Ultros, Obnoxious Octopus",
      "1 Sol Ring",
    ].join("\n");
    const first = await analyzeDeck({ input: ambiguous }, deps);
    expect(first.status).toBe("needs_commander");
    if (first.status !== "needs_commander") throw new Error();
    expect(first.candidates.map((c) => c.name)).toEqual([
      "Teferi, Temporal Archmage",
      "Ultros, Obnoxious Octopus",
    ]);

    const teferi = first.candidates[0];
    const chosen = await analyzeDeck(
      { input: ambiguous, commanders: [teferi?.oracleId ?? ""] },
      deps,
    );
    expect(chosen.status).toBe("ok");
  });
});
