import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordPriceSnapshot, snapshotDate } from "@/application/prices";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../../tests/helpers/test-db";
import { PrismaCardRepository } from "./card-repository";
import { PrismaCollectionRepository } from "./collection-repository";
import { PrismaDeckRepository } from "./deck-repository";
import { PrismaPriceHistory } from "./price-history";
import type { Db } from "./prisma";

let db: Db;
let cleanup: () => Promise<void>;
let prices: PrismaPriceHistory;
const card = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name && x.layout !== "token");
  if (!c) throw new Error(name);
  return c;
};

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "ana");
  const cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  prices = new PrismaPriceHistory(db);
  const crypt = card("Mana Crypt");
  await new PrismaCollectionRepository(db, "ana").addCards([
    { oracleId: crypt.oracleId, name: crypt.name, quantity: 1, foil: false },
  ]);
  await new PrismaDeckRepository(db, "ana").save({
    name: "Teferi",
    input: "",
    source: "text",
    theme: null,
    commanders: [{ oracleId: card("Teferi, Temporal Archmage").oracleId, name: "Teferi" }],
    cards: [{ oracleId: card("Sol Ring").oracleId, quantity: 1 }],
    locked: [],
    excluded: [],
  });
});
afterAll(async () => cleanup());

describe("histórico de precios", () => {
  it("guarda solo las cartas de colecciones y mazos, con el precio más barato", async () => {
    const { date, cards } = await recordPriceSnapshot({ prices }, new Date("2026-10-10T03:00:00Z"));
    expect(date).toBe("2026-10-10");
    const tracked = await db.priceSnapshot.findMany({ orderBy: { oracleId: "asc" } });
    expect(cards).toBe(tracked.length);
    const ids = tracked.map((t) => t.oracleId);
    expect(ids).toContain(card("Mana Crypt").oracleId);
    expect(ids).toContain(card("Sol Ring").oracleId);
    // Una carta que no está en ninguna colección ni mazo no se guarda.
    expect(ids).not.toContain(card("Dig Through Time").oracleId);
    const cheapest = Math.min(
      ...fixturePrintings()
        .filter((p) => p.oracleId === card("Mana Crypt").oracleId && p.priceEur !== null)
        .map((p) => p.priceEur ?? Infinity),
    );
    expect(await prices.history(card("Mana Crypt").oracleId)).toEqual([
      { date: "2026-10-10", eur: cheapest },
    ]);
  });

  it("repetir el mismo día sustituye el precio; otro día se añade", async () => {
    const crypt = card("Mana Crypt").oracleId;
    await db.printing.updateMany({ where: { oracleId: crypt }, data: { priceEur: 99 } });
    await prices.recordSnapshot("2026-10-10");
    await db.printing.updateMany({ where: { oracleId: crypt }, data: { priceEur: 90 } });
    await prices.recordSnapshot("2026-10-11");
    expect(await prices.history(crypt)).toEqual([
      { date: "2026-10-10", eur: 99 },
      { date: "2026-10-11", eur: 90 },
    ]);
    expect(await prices.history(crypt, "2026-10-11")).toEqual([{ date: "2026-10-11", eur: 90 }]);
  });

  it("el día es el de UTC", () => {
    expect(snapshotDate(new Date("2026-10-10T23:30:00-02:00"))).toBe("2026-10-11");
  });
});
