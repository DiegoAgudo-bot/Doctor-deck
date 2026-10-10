import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { PrismaTradeRepository } from "@/adapters/db/trade-repository";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { ensureUsername } from "./social";
import { notifyTradeMatches, tradeMatches, userLists } from "./trades";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
let cards: PrismaCardRepository;
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")!.oracleId;
const deps = () => ({
  cards,
  collectionFor: (u: string) => new PrismaCollectionRepository(db, u),
  decksFor: (u: string) => new PrismaDeckRepository(db, u),
  tradesFor: (u: string) => new PrismaTradeRepository(db, u),
  profiles: social,
  follows: social,
  notifications: social,
});
const give = (user: string, name: string, quantity: number) =>
  new PrismaCollectionRepository(db, user).addCards([
    { oracleId: id(name), name, quantity, foil: false },
  ]);

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  social = new PrismaSocialRepository(db);
  for (const u of ["ana", "beto", "carla"]) {
    await createTestUser(db, u);
    await ensureUsername(u, { profiles: social });
  }
  // Ana: 2 Sol Ring (1 en un mazo) y quiere Mana Crypt para su mazo de Teferi.
  await give("ana", "Sol Ring", 2);
  const deck = await new PrismaDeckRepository(db, "ana").save({
    name: "Teferi",
    input: "",
    source: "text",
    theme: null,
    commanders: [{ oracleId: id("Teferi, Temporal Archmage"), name: "Teferi" }],
    cards: [
      { oracleId: id("Sol Ring"), quantity: 1 },
      { oracleId: id("Mana Crypt"), quantity: 1 },
      { oracleId: id("Island"), quantity: 30 },
    ],
    locked: [],
    excluded: [],
  });
  await new PrismaDeckRepository(db, "ana").setInWishlist(deck, true);
  // Beto tiene Mana Crypt libre y quiere un Sol Ring. Carla también tiene Crypt, pero es privada.
  await give("beto", "Mana Crypt", 1);
  await new PrismaTradeRepository(db, "beto").setWish(id("Sol Ring"), 1);
  await give("carla", "Mana Crypt", 1);
  for (const u of ["ana", "beto"]) await social.setTradesPublic(u, true);
});
afterAll(async () => cleanup());

describe("listas", () => {
  it("deseos: lo que falta de los mazos marcados; para cambiar: copias libres", async () => {
    const ana = await userLists("ana", deps());
    // Le faltan Teferi y Mana Crypt (las islas son básicas).
    expect(ana.wishlist.map((w) => [w.oracleId, w.quantity, w.forDecks]).sort()).toEqual(
      [
        [id("Mana Crypt"), 1, 1],
        [id("Teferi, Temporal Archmage"), 1, 1],
      ].sort(),
    );
    expect(ana.tradelist).toEqual([{ oracleId: id("Sol Ring"), quantity: 1 }]);

    await new PrismaTradeRepository(db, "ana").setKeep(id("Sol Ring"), true);
    expect((await userLists("ana", deps())).tradelist).toEqual([]);
    await new PrismaTradeRepository(db, "ana").setKeep(id("Sol Ring"), false);
  });
});

describe("cruces", () => {
  it("con quién cambiar: solo listas públicas, lo que tiene y lo que quiere", async () => {
    const { partners } = await tradeMatches("ana", deps());
    expect(partners).toHaveLength(1);
    expect(partners[0]).toMatchObject({
      profile: { username: "beto" },
      following: false,
      theyHave: [{ oracleId: id("Mana Crypt"), quantity: 1 }],
      theyWant: [{ oracleId: id("Sol Ring"), quantity: 1 }],
    });
    expect(partners[0]?.haveValue).toBeGreaterThan(100);
  });

  it("avisa de cada carta una sola vez", async () => {
    expect(await notifyTradeMatches(deps())).toBe(2); // a Ana (Crypt de Beto) y a Beto (Sol Ring de Ana)
    const [n] = await social.list("ana", 5);
    expect(n).toMatchObject({
      type: "trade_match",
      title: "Mana Crypt",
      actor: { username: "beto" },
    });
    expect(await notifyTradeMatches(deps())).toBe(0);
  });
});
