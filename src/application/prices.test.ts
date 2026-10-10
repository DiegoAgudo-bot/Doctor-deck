import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import { PrismaPriceHistory } from "@/adapters/db/price-history";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { collectionPrices, notifyPriceDrops } from "./prices";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
let prices: PrismaPriceHistory;
let cards: PrismaCardRepository;
const card = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name && x.layout !== "token");
  if (!c) throw new Error(name);
  return c;
};
const snapshot = (name: string, ...points: [string, number][]) =>
  db.priceSnapshot.createMany({
    data: points.map(([date, eur]) => ({ oracleId: card(name).oracleId, date, eur })),
  });
let deckId: string;
const deps = () => ({
  prices,
  profiles: social,
  notifications: social,
  cards,
  collectionFor: (id: string) => new PrismaCollectionRepository(db, id),
  decksFor: (id: string) => new PrismaDeckRepository(db, id),
});

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  social = new PrismaSocialRepository(db);
  prices = new PrismaPriceHistory(db);
  await createTestUser(db, "ana");
  await createTestUser(db, "beto");
  // Ana tiene Sol Ring; su mazo pide además Mana Crypt (le falta) y 30 islas (básicas).
  await new PrismaCollectionRepository(db, "ana").addCards([
    { oracleId: card("Sol Ring").oracleId, name: "Sol Ring", quantity: 1, foil: false },
  ]);
  deckId = await new PrismaDeckRepository(db, "ana").save({
    name: "Teferi",
    input: "",
    source: "text",
    theme: null,
    commanders: [{ oracleId: card("Teferi, Temporal Archmage").oracleId, name: "Teferi" }],
    cards: [
      { oracleId: card("Sol Ring").oracleId, quantity: 1 },
      { oracleId: card("Mana Crypt").oracleId, quantity: 1 },
      { oracleId: card("Island").oracleId, quantity: 30 },
    ],
    locked: [],
    excluded: [],
  });
  await snapshot("Mana Crypt", ["2026-09-20", 200], ["2026-10-01", 180], ["2026-10-10", 150]);
  await snapshot("Sol Ring", ["2026-09-20", 1], ["2026-10-10", 0.5]);
  await snapshot("Island", ["2026-09-20", 1], ["2026-10-10", 0.1]);
  await snapshot("Teferi, Temporal Archmage", ["2026-10-10", 2]);
});
afterAll(async () => cleanup());

describe("notifyPriceDrops", () => {
  const today = new Date("2026-10-10T05:00:00Z");

  it("avisa de lo que me falta si baja del umbral, una vez por semana", async () => {
    // Ana tiene el 15 % por defecto: Mana Crypt baja un 25 % (200 → 150). Sol Ring también baja,
    // pero ya la tengo; la isla es básica; Teferi no tiene días anteriores.
    expect(await notifyPriceDrops(deps(), today)).toBe(1);
    const [n] = await social.list("ana", 5);
    expect(n).toMatchObject({
      type: "price_drop",
      title: "Mana Crypt",
      price: 150,
      prevPrice: 200,
      deckId,
      actor: { name: "ana" },
    });
    // Al día siguiente no se repite.
    expect(await notifyPriceDrops(deps(), today)).toBe(0);
    expect(await social.list("beto", 5)).toEqual([]);
  });

  it("respeta el umbral de cada uno y se puede desactivar", async () => {
    await db.notification.deleteMany();
    await social.setPriceAlertPercent("ana", 30);
    expect(await notifyPriceDrops(deps(), today)).toBe(0);
    await social.setPriceAlertPercent("ana", null);
    expect(await social.priceAlertPercent("ana")).toBeNull();
    expect(await notifyPriceDrops(deps(), today)).toBe(0);
    await social.setPriceAlertPercent("ana", 15);
  });

  it("sin precio de hoy no compara con datos viejos", async () => {
    await db.notification.deleteMany();
    expect(await notifyPriceDrops(deps(), new Date("2026-10-12T05:00:00Z"))).toBe(0);
  });
});

describe("collectionPrices", () => {
  it("valor por día y lo que más se mueve, desde el último día con precios", async () => {
    const owned = new Map([
      [card("Sol Ring").oracleId, 2],
      [card("Mana Crypt").oracleId, 1],
    ]);
    const r = await collectionPrices({ owned, days: 30, limit: 5 }, { prices });
    expect(r.latest).toBe("2026-10-10");
    expect(r.since).toBe("2026-09-10");
    expect(r.value).toEqual([
      { date: "2026-09-20", eur: 202 },
      { date: "2026-10-01", eur: 182 },
      { date: "2026-10-10", eur: 151 },
    ]);
    expect(r.up).toEqual([]);
    expect(r.down.map((m) => [m.oracleId, m.valueDelta])).toEqual([
      [card("Mana Crypt").oracleId, -50],
      [card("Sol Ring").oracleId, -1],
    ]);
  });
});
