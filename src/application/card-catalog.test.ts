import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository, PrismaPublicDecks } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaTradeRepository } from "@/adapters/db/trade-repository";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import type { RecommendationSource } from "@/domain/ports/recommendation-source";
import type { CardRecommendation } from "@/domain/recommendations/types";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { cardDetail, commanderStaples } from "./card-catalog";
import { AppError } from "./errors";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")!.oracleId;

const rec = (name: string, categories: string[], inclusion: number): CardRecommendation => ({
  name,
  categories,
  inclusion,
  synergy: 0.1,
  numDecks: Math.round(inclusion * 1000),
  potentialDecks: 1000,
});

const queries: unknown[] = [];
const source: RecommendationSource = {
  async getRecommendations(query) {
    queries.push(query);
    return {
      commanderSlug: "ultros-obnoxious-octopus",
      theme: query.theme ?? null,
      totalDecks: 1000,
      themes: [{ slug: "spellslinger", name: "Spellslinger", count: 300 }],
      cards: [
        rec("Sol Ring", ["topcards", "manaartifacts"], 0.95),
        rec("Dig Through Time", ["instants", "highsynergycards"], 0.4),
        rec("Cackling Counterpart", ["instants"], 0.6),
        rec("Ultros, Obnoxious Octopus", ["topcards"], 1),
        rec("Carta Inventada", ["creatures"], 0.5),
      ],
      fetchedAt: new Date(),
      stale: false,
      warning: null,
    };
  },
};

const deps = () => ({
  cards,
  recommendations: source,
  classifier: new HeuristicRoleClassifier(),
  publicDecks: new PrismaPublicDecks(db),
  collectionFor: (u: string) => new PrismaCollectionRepository(db, u),
  decksFor: (u: string) => new PrismaDeckRepository(db, u),
  tradesFor: (u: string) => new PrismaTradeRepository(db, u),
});

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  await createTestUser(db, "ana");
  await new PrismaCollectionRepository(db, "ana").addCards([
    { oracleId: id("Sol Ring"), name: "Sol Ring", quantity: 2, foil: false, language: "en" },
  ]);
});
afterAll(async () => cleanup());

describe("commanderStaples", () => {
  it("agrupa lo de EDHREC por listas, sin el propio comandante, con precio y mis copias", async () => {
    const s = await commanderStaples(
      id("Ultros, Obnoxious Octopus"),
      "spellslinger",
      "ana",
      deps(),
    );
    expect(queries.at(-1)).toEqual({
      commanders: ["Ultros, Obnoxious Octopus"],
      theme: "spellslinger",
    });
    expect(s.sections.map((x) => [x.label, x.cards.map((c) => c.card.name)])).toEqual([
      ["Alta sinergia", ["Dig Through Time"]],
      ["Las más jugadas", ["Sol Ring"]],
      ["Instantáneos", ["Cackling Counterpart", "Dig Through Time"]],
      ["Artefactos de maná", ["Sol Ring"]],
    ]);
    expect(s.mine?.get(id("Sol Ring"))).toEqual({ owned: 2, free: 2 });
    expect(s.prices.get(id("Sol Ring"))).toBeGreaterThan(0);
    expect(s.totalDecks).toBe(1000);
  });

  it("solo para comandantes", async () => {
    const err = await commanderStaples(id("Sol Ring"), null, null, deps()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("not_commander");
  });
});

describe("cardDetail", () => {
  it("datos, impresiones, mis copias y si puede ser comandante", async () => {
    const d = await cardDetail(id("Sol Ring"), "ana", deps());
    expect(d).toMatchObject({ commander: false, mine: { owned: 2, free: 2, wished: 0 } });
    expect(d.printings.length).toBeGreaterThan(0);
    expect((await cardDetail(id("Ultros, Obnoxious Octopus"), null, deps())).commander).toBe(true);
  });
});
