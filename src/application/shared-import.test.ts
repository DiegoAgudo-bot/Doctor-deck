import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import type { Db } from "@/adapters/db/prisma";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { importShared, looksLikeCsv } from "./shared-import";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

const printingOf = (name: string) => {
  const card = fixtureCards().find((c) => c.name === name && c.layout !== "token");
  const p = fixturePrintings().find((x) => x.oracleId === card?.oracleId);
  if (!p) throw new Error(name);
  return p;
};

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "u1");
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

describe("importShared", () => {
  it("lista de ManaBox: impresión por (SET) número, foil, y lo que no existe aparte", async () => {
    const sol = printingOf("Sol Ring");
    const text = [
      `2 Sol Ring (${sol.setCode.toUpperCase()}) ${sol.collectorNumber} *F*`,
      "1 Dig Through Time",
      "1 Carta Que No Existe (XXX) 1",
    ].join("\n");
    const preview = await importShared(text, {
      cards,
      collection: new BrowserCollectionRepository(),
    });
    expect(preview.kind).toBe("list");
    expect(preview.added).toHaveLength(2);
    expect(preview.added[0]).toMatchObject({ quantity: 2, foil: true });
    expect(preview.added[0]?.scryfallId?.toLowerCase()).toBe(sol.scryfallId.toLowerCase());
    expect(preview.notFound).toEqual(["Carta Que No Existe"]);
    expect(preview.totalCopies).toBe(3);
    expect(preview.looksLikeDeck).toBe(false);
    // La vista previa no guarda nada.
    const collection = new PrismaCollectionRepository(db, "u1");
    expect(await collection.entries()).toHaveLength(0);

    await importShared(text, { cards, collection });
    const entries = await collection.entries();
    expect(entries.map((e) => [e.quantity, e.foil, e.source]).sort()).toEqual([
      [1, false, "manual"],
      [2, true, "manual"],
    ]);
  });

  it("con comandante marcado se ve como mazo", async () => {
    const r = await importShared("Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Sol Ring", {
      cards,
      collection: new BrowserCollectionRepository(),
    });
    expect(r.looksLikeDeck).toBe(true);
  });

  it("CSV de ManaBox: por Scryfall ID, con idioma", async () => {
    const sol = printingOf("Sol Ring");
    const csv = [
      "Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Language",
      `Sol Ring,${sol.setCode},${sol.collectorNumber},normal,3,${sol.scryfallId},Spanish`,
    ].join("\n");
    expect(looksLikeCsv(csv)).toBe(true);
    expect(looksLikeCsv("1 Sol Ring")).toBe(false);
    const r = await importShared(csv, { cards, collection: new BrowserCollectionRepository() });
    expect(r.kind).toBe("csv");
    expect(r.added[0]).toMatchObject({ quantity: 3, foil: false, language: "es" });
  });
});
