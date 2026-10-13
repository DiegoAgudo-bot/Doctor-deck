import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { addCardToDeck } from "./add-card-to-deck";
import { AppError } from "./errors";
import { saveDeck } from "./save-deck";

let cleanup: () => Promise<void>;
let deps: Parameters<typeof addCardToDeck>[2];
let cards: PrismaCardRepository;
let deckId: string;

const oracleIdOf = async (name: string) => {
  const [card] = await cards.searchByName(name, 1);
  if (!card) throw new Error(`No está ${name}`);
  return card.oracleId;
};

beforeAll(async () => {
  const t = createTestDb();
  cleanup = t.cleanup;
  cards = new PrismaCardRepository(t.db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  await createTestUser(t.db, "u1");
  deps = { sources: [textDeckSource], cards, decks: new PrismaDeckRepository(t.db, "u1") };
  ({ id: deckId } = await saveDeck(
    {
      name: "Teferi",
      input:
        "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Sol Ring\n10 Island\n1 Carta Inventada",
      theme: "control",
      locked: [],
      excluded: [],
    },
    deps,
  ));
});
afterAll(async () => cleanup());

describe("addCardToDeck", () => {
  it("añade la carta y conserva el tema y lo que no se encontró", async () => {
    const res = await addCardToDeck(deckId, await oracleIdOf("Dig Through Time"), deps);
    expect(res).toMatchObject({ deckId, deckName: "Teferi", card: "Dig Through Time" });
    const saved = await deps.decks.get(deckId);
    expect(saved?.input).toContain("1 Dig Through Time");
    expect(saved?.input).toContain("1 Carta Inventada");
    expect(saved?.theme).toBe("control");
    expect(saved?.cardCount).toBe(13); // con el comandante
  });

  it("no añade otra copia ni cartas fuera de los colores del comandante", async () => {
    await expect(addCardToDeck(deckId, await oracleIdOf("Sol Ring"), deps)).rejects.toMatchObject({
      code: "already_in_deck",
      status: 409,
    });
    // Sorin, Vampire Lord es negro; Teferi, azul.
    const err = await addCardToDeck(deckId, await oracleIdOf("Sorin, Vampire Lord"), deps).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("off_color");
  });

  it("un mazo que no es mío no existe", async () => {
    await expect(
      addCardToDeck(
        "00000000-0000-4000-8000-000000000000",
        await oracleIdOf("Lantern Flare"),
        deps,
      ).catch((e: unknown) => (e as AppError).code),
    ).resolves.toBe("not_found");
  });
});
