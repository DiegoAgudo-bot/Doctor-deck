import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import type { Combo } from "@/domain/combos/types";
import type { ComboQuery } from "@/domain/ports/combo-source";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { deckCombos } from "./deck-combos";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")!.oracleId;
const combo = (cid: string, names: string[], bracketTag: Combo["bracketTag"]): Combo => ({
  id: cid,
  cards: names.map((name) => ({ oracleId: id(name), name, mustBeCommander: false })),
  produces: ["Infinite colorless mana"],
  requires: [],
  bracketTag,
  manaValueNeeded: 2,
  popularity: 100,
});
const queries: ComboQuery[] = [];

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  await createTestUser(db, "ana");
  await new PrismaCollectionRepository(db, "ana").addCards([
    { oracleId: id("Dig Through Time"), name: "Dig Through Time", quantity: 1, foil: false },
  ]);
});
afterAll(async () => cleanup());

describe("deckCombos", () => {
  it("combos completos suben el bracket; a una carta, con la que falta y si la tengo", async () => {
    const r = await deckCombos(
      { input: "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Sol Ring\n1 Island" },
      {
        sources: [textDeckSource],
        cards,
        collection: new PrismaCollectionRepository(db, "ana"),
        decks: new PrismaDeckRepository(db, "ana"),
        classifier: new HeuristicRoleClassifier(),
        combos: {
          findCombos: async (q) => {
            queries.push(q);
            return {
              included: [combo("1", ["Teferi, Temporal Archmage", "Sol Ring"], "R")],
              almostIncluded: [
                combo("2", ["Sol Ring", "Mana Crypt"], "C"),
                combo("3", ["Sol Ring", "Dig Through Time"], "C"),
                combo("4", ["Sol Ring", "Body of Knowledge"], "B"),
              ],
              fetchedAt: new Date("2026-10-11"),
              stale: false,
              warning: null,
            };
          },
        },
      },
    );
    expect(queries[0]).toEqual({
      commanders: ["Teferi, Temporal Archmage"],
      main: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Island", quantity: 1 },
      ],
    });
    expect(r?.bracket).toMatchObject({ bracket: 4, combosChecked: true });
    // Dig Through Time la tengo: primero. Mana Crypt hay que comprarla. El de una prohibida, fuera.
    expect(r?.oneAway.map((o) => [o.missing.name, o.status])).toEqual([
      ["Dig Through Time", "owned"],
      ["Mana Crypt", "buy"],
    ]);
    expect(r?.oneAway[1]?.price).toBeGreaterThan(0);
  });
});
