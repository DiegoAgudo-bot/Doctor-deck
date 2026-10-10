import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaDeckRepository, PrismaPublicDecks } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { browseCommunity, refreshDeckFacts, type BrowseCommunityRequest } from "./community";
import { saveDeck } from "./save-deck";
import { ensureUsername } from "./social";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
let social: PrismaSocialRepository;
let publicDecks: PrismaPublicDecks;
const card = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name && x.layout !== "token");
  if (!c) throw new Error(name);
  return c;
};
const deps = () => ({ publicDecks, cards, follows: social, profiles: social });
const save = (userId: string, name: string, list: string) =>
  saveDeck(
    { name, input: `Commander\n1 Teferi, Temporal Archmage\n\nDeck\n${list}` },
    { sources: [textDeckSource], cards, decks: new PrismaDeckRepository(db, userId) },
  );
const browse = (extra: Partial<Parameters<typeof browseCommunity>[0]> = {}) =>
  browseCommunity(
    {
      viewerId: null,
      filters: {},
      sort: "recent",
      offset: 0,
      limit: 10,
      owned: new Map(),
      ...extra,
    },
    deps(),
  );

let solDeck: string;
let cryptDeck: string;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  social = new PrismaSocialRepository(db);
  publicDecks = new PrismaPublicDecks(db);
  for (const u of ["ana", "beto", "carla"]) {
    await createTestUser(db, u);
    await ensureUsername(u, { profiles: social });
  }
  solDeck = (await save("ana", "Teferi barato", "1 Sol Ring\n30 Island")).id;
  cryptDeck = (await save("beto", "Teferi caro", "1 Mana Crypt\n1 Sol Ring")).id;
});
afterAll(async () => cleanup());

describe("datos para filtrar", () => {
  it("se calculan al guardar y se rellenan si faltan", async () => {
    const row = await db.deck.findFirstOrThrow({ where: { publicId: solDeck } });
    expect(row).toMatchObject({ colorIdentity: "U", bracket: 2 });
    await db.deck.updateMany({ data: { colorIdentity: null, bracket: null } });
    const before = await db.deck.findFirstOrThrow({ where: { publicId: solDeck } });
    expect(await refreshDeckFacts({ publicDecks, cards }, { all: false })).toBe(2);
    expect(await refreshDeckFacts({ publicDecks, cards }, { all: false })).toBe(0);
    expect(await refreshDeckFacts({ publicDecks, cards }, { all: true })).toBe(2);
    // Recalcular no cuenta como editar el mazo.
    expect((await db.deck.findFirstOrThrow({ where: { publicId: solDeck } })).updatedAt).toEqual(
      before.updatedAt,
    );
  });
});

describe("browseCommunity", () => {
  it("cuánto tengo de cada mazo y ordenar por eso", async () => {
    const owned = new Map([[card("Sol Ring").oracleId, 1]]);
    const { items, total } = await browse({ owned, sort: "owned" });
    expect(total).toBe(2);
    expect(items.map((i) => i.deck.name)).toEqual(["Teferi barato", "Teferi caro"]);
    // Teferi + Sol Ring (las islas no cuentan): tengo 1 de 2.
    expect(items[0]?.ownership).toMatchObject({ cards: 2, have: 1, percent: 50 });
    // Me faltan Teferi y Mana Crypt; el precio sale de las impresiones.
    expect(items[1]?.ownership).toMatchObject({ cards: 3, have: 1, toBuy: 2 });
    expect(items[1]?.ownership.cost).toBeGreaterThan(100);
  });

  it("filtra por texto, colores, bracket, gente que sigo y perfil", async () => {
    const names = async (
      filters: BrowseCommunityRequest["filters"],
      viewerId: string | null = null,
    ) => (await browse({ filters, viewerId })).items.map((i) => i.deck.name);
    expect(await names({ q: "barato" })).toEqual(["Teferi barato"]);
    expect(await names({ q: "teferi, temporal" })).toHaveLength(2);
    expect(await names({ colors: "U" })).toHaveLength(2);
    expect(await names({ colors: "WR" })).toEqual([]);
    expect(await names({ bracket: 3 })).toEqual([]);
    expect(await names({ following: true }, "carla")).toEqual([]);
    await social.follow("carla", "beto");
    expect(await names({ following: true }, "carla")).toEqual(["Teferi caro"]);
    expect(await names({ following: true })).toEqual([]);
    expect(await names({ username: "ANA" })).toEqual(["Teferi barato"]);
    expect(await names({ username: "nadie" })).toEqual([]);
  });

  it("me gusta: no a los propios ni a los privados; ordena por los más gustados", async () => {
    expect(await publicDecks.setLike("ana", solDeck, true)).toBeNull();
    expect(await publicDecks.setLike("beto", solDeck, true)).toEqual({ likes: 1 });
    expect(await publicDecks.setLike("beto", solDeck, true)).toEqual({ likes: 1 });
    expect(await publicDecks.setLike("carla", solDeck, true)).toEqual({ likes: 2 });
    expect(await publicDecks.setLike("carla", cryptDeck, true)).toEqual({ likes: 1 });

    const { items } = await browse({ sort: "likes", viewerId: "carla" });
    expect(items.map((i) => [i.deck.name, i.deck.likes, i.liked])).toEqual([
      ["Teferi barato", 2, true],
      ["Teferi caro", 1, true],
    ]);
    expect(await publicDecks.setLike("carla", solDeck, false)).toEqual({ likes: 1 });

    await new PrismaDeckRepository(db, "beto").setVisibility(cryptDeck, "private");
    expect(await publicDecks.setLike("ana", cryptDeck, true)).toBeNull();
    expect((await browse()).items.map((i) => i.deck.name)).toEqual(["Teferi barato"]);
  });
});
