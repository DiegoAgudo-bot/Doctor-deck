import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { deckVersions, restoreDeckVersion } from "./deck-versions";
import { saveDeck } from "./save-deck";

let cleanup: () => Promise<void>;
let deps: Parameters<typeof restoreDeckVersion>[2];

beforeAll(async () => {
  const t = createTestDb();
  cleanup = t.cleanup;
  const cards = new PrismaCardRepository(t.db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  await createTestUser(t.db, "u1");
  deps = { sources: [textDeckSource], cards, decks: new PrismaDeckRepository(t.db, "u1") };
});
afterAll(async () => cleanup());

const list = (cards: string) => `Commander\n1 Teferi, Temporal Archmage\n\nDeck\n${cards}`;

describe("historial de versiones", () => {
  it("guarda la anterior al cambiar la lista, dice qué cambió y la restaura", async () => {
    const { id } = await saveDeck({ input: list("1 Sol Ring\n10 Island") }, deps);
    expect(await deckVersions(id, deps)).toEqual([]);

    // Mismo texto: no hay versión nueva.
    await saveDeck({ id, input: list("1 Sol Ring\n10 Island") }, deps);
    expect(await deckVersions(id, deps)).toEqual([]);

    await saveDeck({ id, input: list("1 Dig Through Time\n9 Island") }, deps);
    const [v] = await deckVersions(id, deps);
    expect(v).toMatchObject({ cardCount: 12 });
    expect(v?.added).toEqual([{ name: "Dig Through Time", copies: 1 }]);
    expect(v?.removed).toEqual(
      expect.arrayContaining([
        { name: "Sol Ring", copies: 1 },
        { name: "Island", copies: 1 },
      ]),
    );

    await restoreDeckVersion(id, v!.id, deps);
    const saved = await deps.decks.get(id);
    expect(saved?.input).toContain("1 Sol Ring");
    expect(saved?.cardCount).toBe(12);
  });
});
