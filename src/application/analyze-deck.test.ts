import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { HttpClient } from "@/adapters/http/http-client";
import { MemoryResponseCache } from "@/adapters/http/memory-cache";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { mergeEngineConfig } from "@/domain/suggestions/config";
import { fixtureCards, fixturePrintings, readFixture } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { analyzeDeck, type AnalyzeDeckDeps } from "./analyze-deck";
import { importCollection } from "./import-collection";
import { DeckWithoutCommanderError, saveDeck } from "./save-deck";

let cleanup: () => Promise<void>;
let deps: AnalyzeDeckDeps;
const requested: string[] = [];

beforeAll(async () => {
  const t = createTestDb();
  cleanup = t.cleanup;
  const cards = new PrismaCardRepository(t.db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  await createTestUser(t.db, "u1");
  const collection = new PrismaCollectionRepository(t.db, "u1");
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
    decks: new PrismaDeckRepository(t.db, "u1"),
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

  it("dice qué cartas del mazo tengo, cuáles me faltan y cuánto cuestan", async () => {
    const result = await analyzeDeck({ input: DECK }, deps);
    if (result.status !== "ok") throw new Error();
    const { items, totals, prices, cost } = result.ownership;
    const status = (name: string) => items.find((i) => i.card.name === name)?.status;
    // De mi CSV: Ultros, Tamiyo's Logbook, Ichor Synthesizer y Thundertrap Trainer.
    expect(status("Thundertrap Trainer")).toBe("owned");
    expect(status("Ultros, Obnoxious Octopus")).toBe("owned");
    // No los tengo: Teferi (comandante) y Sol Ring. Las islas son básicas.
    expect(status("Teferi, Temporal Archmage")).toBe("missing");
    expect(status("Sol Ring")).toBe("missing");
    expect(status("Island")).toBe("basic");
    expect(totals).toEqual({ cards: 6, have: 4, fromOtherDecks: 0, toBuy: 2 });
    // Precio de la impresión más barata de cada una: Sol Ring 0,80 €, Teferi 3,50 €.
    expect(prices.get(items.find((i) => i.card.name === "Sol Ring")?.card.oracleId ?? "")).toBe(
      0.8,
    );
    expect(cost).toBe(4.3);
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

describe("analyzeDeck: mazos guardados y modo compra", () => {
  const DECK_WITHOUT_SOL_RING = DECK.replace("1 Sol Ring\n", "");
  const OTHER = "Commander\n1 Teferi, Temporal Archmage\nDeck\n1 Dig Through Time\n10 Island";

  async function cleanDecks() {
    for (const d of await deps.decks.list()) await deps.decks.delete(d.id);
  }

  it("guarda un mazo con su comandante y las cartas resueltas", async () => {
    await cleanDecks();
    const saved = await saveDeck({ input: OTHER }, deps);
    expect(saved.name).toBe("Teferi, Temporal Archmage");
    const stored = await deps.decks.get(saved.id);
    expect(stored).toMatchObject({
      source: "text",
      cardCount: 12,
      commanderNames: ["Teferi, Temporal Archmage"],
    });
    await expect(saveDeck({ input: "1 Sol Ring" }, deps)).rejects.toBeInstanceOf(
      DeckWithoutCommanderError,
    );
  });

  it("descuenta las copias que usan otros mazos guardados", async () => {
    await cleanDecks();
    await saveDeck({ input: OTHER, name: "Otro Teferi" }, deps);

    const result = await analyzeDeck({ input: DECK }, deps);
    if (result.status !== "ok") throw new Error();
    const { addCandidates, unavailableCandidates, swaps } = result.suggestions;
    expect(addCandidates.map((c) => c.card.name)).not.toContain("Dig Through Time");
    expect(unavailableCandidates.map((c) => [c.card.name, c.usedIn])).toEqual([
      ["Dig Through Time", ["Otro Teferi"]],
    ]);
    expect(swaps.map((s) => s.in.card.name)).not.toContain("Dig Through Time");

    const ignoring = await analyzeDeck({ input: DECK, useOtherDecks: false }, deps);
    if (ignoring.status !== "ok") throw new Error();
    expect(ignoring.suggestions.swaps[0]?.in.card.name).toBe("Dig Through Time");
  });

  it("las copias del propio mazo guardado no cuentan como usadas", async () => {
    await cleanDecks();
    const { id } = await saveDeck({ input: OTHER, name: "Este" }, deps);
    const result = await analyzeDeck({ input: DECK, deckId: id }, deps);
    if (result.status !== "ok") throw new Error();
    expect(result.suggestions.addCandidates.map((c) => c.card.name)).toContain("Dig Through Time");
  });

  it("modo compra: propone cartas que no tengo, con su precio de referencia", async () => {
    await cleanDecks();
    const result = await analyzeDeck(
      { input: DECK_WITHOUT_SOL_RING, buy: { maxCards: 3, maxPrice: 2 } },
      deps,
    );
    if (result.status !== "ok") throw new Error();
    const purchases = result.purchases;
    expect(purchases?.purchases.map((p) => [p.in.card.name, p.in.price])).toEqual([
      ["Sol Ring", 0.8],
    ]);
    expect(purchases?.totalCost).toBe(0.8);
    expect(purchases?.purchases[0]?.reason).toContain("cuesta unos 0,80 €");

    const none = await analyzeDeck(
      { input: DECK_WITHOUT_SOL_RING, buy: { maxCards: 3, maxPrice: 0.5 } },
      deps,
    );
    if (none.status !== "ok") throw new Error();
    expect(none.purchases?.purchases).toEqual([]);

    const noBuy = await analyzeDeck({ input: DECK }, deps);
    if (noBuy.status !== "ok") throw new Error();
    expect(noBuy.purchases).toBeNull();
  });
});

describe("analyzeDeck: roles corregidos y etiquetas", () => {
  const ultros = () => fixtureCards().find((c) => c.name === "Ultros, Obnoxious Octopus")!;
  const ok = async (req: Parameters<typeof analyzeDeck>[0]) => {
    const r = await analyzeDeck(req, deps);
    if (r.status !== "ok") throw new Error(r.status);
    return r;
  };

  it("las etiquetas de la lista cambian los roles; las libres se guardan aparte", async () => {
    const plain = await ok({ input: DECK });
    const tagged = await ok({
      input: DECK.replace(
        "1 Ultros, Obnoxious Octopus",
        "1 Ultros, Obnoxious Octopus #!Removal #wincon",
      ),
    });
    expect(tagged.roles.classifier.classify(ultros()).primary).toBe("removal");
    expect(tagged.roles.sourceOf(ultros())).toBe("list");
    expect(tagged.tags.get(ultros().oracleId)).toEqual(["wincon"]);
    expect(tagged.suggestions.roleCounts.removal).toBe(plain.suggestions.roleCounts.removal + 1);
  });

  it("mis correcciones mandan sobre las etiquetas de la lista", async () => {
    const r = await ok({
      input: DECK.replace("1 Ultros, Obnoxious Octopus", "1 Ultros, Obnoxious Octopus #!Removal"),
      roleEdits: new Map([
        [ultros().oracleId, { override: { roles: ["draw"], primary: "draw" }, tags: ["kraken"] }],
      ]),
    });
    expect(r.roles.classifier.classify(ultros())).toEqual({ roles: ["draw"], primary: "draw" });
    expect(r.roles.sourceOf(ultros())).toBe("mine");
    expect(r.tags.get(ultros().oracleId)).toEqual(["kraken"]);
  });
});
