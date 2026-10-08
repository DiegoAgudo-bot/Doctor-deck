import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../../tests/helpers/test-db";
import { PrismaCardRepository } from "./card-repository";
import { PrismaDeckRepository } from "./deck-repository";
import type { Db } from "./prisma";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(() => {
  ({ db, cleanup } = createTestDb());
});
afterAll(async () => cleanup());

const base = {
  input: "1 Sol Ring",
  source: "text",
  theme: null,
  locked: [],
  excluded: [],
};

describe("PrismaDeckRepository", () => {
  it("guarda, lee, lista, actualiza y borra", async () => {
    const repo = new PrismaDeckRepository(db);
    const id = await repo.save({
      ...base,
      name: "Teferi",
      theme: "control",
      commanders: [{ oracleId: "teferi", name: "Teferi, Temporal Archmage" }],
      cards: [
        { oracleId: "sol", quantity: 1 },
        { oracleId: "island", quantity: 30 },
      ],
      locked: ["sol"],
      excluded: ["dig"],
    });
    expect(await repo.get(id)).toMatchObject({
      id,
      name: "Teferi",
      theme: "control",
      source: "text",
      input: "1 Sol Ring",
      commanders: ["teferi"],
      commanderNames: ["Teferi, Temporal Archmage"],
      locked: ["sol"],
      excluded: ["dig"],
      cardCount: 32,
    });

    await repo.save({
      ...base,
      id,
      name: "Teferi v2",
      commanders: [{ oracleId: "teferi", name: "T" }],
      cards: [],
    });
    expect(await repo.get(id)).toMatchObject({ name: "Teferi v2", cardCount: 1, locked: [] });
    expect((await repo.list()).map((d) => d.name)).toEqual(["Teferi v2"]);

    expect(await repo.delete(id)).toBe(true);
    expect(await repo.get(id)).toBeNull();
    expect(await repo.delete(id)).toBe(false);
  });

  it("calcula las copias usadas en otros mazos", async () => {
    const repo = new PrismaDeckRepository(db);
    const a = await repo.save({
      ...base,
      name: "Atraxa",
      commanders: [{ oracleId: "atraxa", name: "Atraxa" }],
      cards: [{ oracleId: "sol", quantity: 1 }],
    });
    const b = await repo.save({
      ...base,
      name: "Krenko",
      commanders: [{ oracleId: "krenko", name: "Krenko" }],
      cards: [
        { oracleId: "sol", quantity: 1 },
        { oracleId: "atraxa", quantity: 1 },
      ],
    });
    const all = await repo.usage();
    expect(all.get("sol")).toEqual({ quantity: 2, decks: ["Atraxa", "Krenko"] });
    expect(all.get("atraxa")).toEqual({ quantity: 2, decks: ["Atraxa", "Krenko"] });

    const exceptA = await repo.usage(a);
    expect(exceptA.get("sol")).toEqual({ quantity: 1, decks: ["Krenko"] });
    expect(exceptA.has("krenko")).toBe(true);
    expect((await repo.usage(b)).has("krenko")).toBe(false);
  });
});

describe("PrismaCardRepository.findMinPrices", () => {
  it("devuelve el precio más barato de cada carta", async () => {
    const cards = new PrismaCardRepository(db);
    await cards.insertCards(fixtureCards());
    await cards.insertPrintings(fixturePrintings());
    const byName = (n: string) =>
      fixtureCards().find((c) => c.name === n && c.layout === "normal")?.oracleId ?? "";
    const prices = await cards.findMinPrices([
      byName("Sol Ring"),
      byName("Mana Crypt"),
      "desconocida",
    ]);
    expect(prices.get(byName("Sol Ring"))).toBe(0.8); // 1.20 (C21) vs 0.80 (LEA)
    expect(prices.get(byName("Mana Crypt"))).toBe(150);
    expect(prices.has("desconocida")).toBe(false);
  });
});
