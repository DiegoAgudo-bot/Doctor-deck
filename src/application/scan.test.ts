import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import type { Db } from "@/adapters/db/prisma";
import { NameIndex } from "@/domain/cards/name-match";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../tests/helpers/test-db";
import { identifyScan } from "./scan";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;
let index: NameIndex;
const scan = (lines: string[]) => identifyScan(lines, { cards, names: async () => index });

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  index = new NameIndex(await cards.nameEntries());
});
afterAll(async () => cleanup());

describe("identifyScan", () => {
  it("edición + número → la impresión exacta, con el nombre de acuerdo", async () => {
    const r = await scan(["Sol Ring 1", "Artifact", "0263 U", "C21 • EN"]);
    expect(r.match).toMatchObject({ via: "set_number", card: { name: "Sol Ring" } });
    expect(r.match?.printing).toMatchObject({ setCode: "c21", collectorNumber: "263" });
    expect(r.match!.confidence).toBeGreaterThan(0.95);
  });

  it("una carta en español se reconoce por edición y número aunque el nombre no cuadre", async () => {
    const r = await scan(["Anillo solar", "Artefacto", "0263 U", "C21 • ES"]);
    expect(r.match?.card.name).toBe("Sol Ring");
    expect(r.reading.language).toBe("es");
  });

  it("corrige la edición mal leída (0↔O)", async () => {
    const r = await scan(["Sorin, Vampire Lord", "290/280 M", "M2O • EN"]);
    expect(r.match?.printing).toMatchObject({ setCode: "m20", collectorNumber: "290" });
  });

  it("sin edición ni número, por el nombre (sin impresión)", async () => {
    const r = await scan(["Ultros Obnoxious 0ctopus", "Legendary Creature"]);
    expect(r.match).toMatchObject({ via: "name", printing: null });
    expect(r.match?.card.name).toBe("Ultros, Obnoxious Octopus");
  });

  it("en inglés, si el nombre contradice a la edición leída, manda el nombre", async () => {
    // 263 de C21 es Sol Ring, pero se lee claramente otra carta: el número estaba mal leído.
    const r = await scan(["Lantern Flare", "0263 U", "C21 • EN"]);
    expect(r.match).toMatchObject({ via: "name", card: { name: "Lantern Flare" } });
  });

  it("no reconoce nada si no se parece a ninguna carta", async () => {
    expect((await scan(["Creature — Elf Druid", "{T}: Add {G}."])).match).toBeNull();
  });
});
