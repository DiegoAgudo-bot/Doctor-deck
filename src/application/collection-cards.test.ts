import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { parseManaboxCsv } from "@/domain/collection/manabox";
import {
  addToCollection,
  collectionLines,
  collectionView,
  editCollectionLine,
  exportCollectionCsv,
  InvalidPrintingError,
} from "./collection-cards";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

const byName = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name && x.layout !== "token");
  if (!c) throw new Error(name);
  return c;
};
const csvRow = (name: string, quantity: number, line: number, setCode: string | null = null) => ({
  line,
  name,
  setCode,
  collectorNumber: null,
  scryfallId: null,
  quantity,
  foil: false,
  language: "en" as const,
  condition: null,
  raw: { Name: name },
});

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "u1");
  await createTestUser(db, "u2");
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

describe("addToCollection", () => {
  it("resuelve por oracleId, por impresión (escáner) y por nombre, y avisa de lo que no existe", async () => {
    const collection = new PrismaCollectionRepository(db, "u1");
    const trainer = fixturePrintings().find(
      (p) => p.oracleId === byName("Thundertrap Trainer").oracleId,
    );
    const res = await addToCollection(
      [
        { oracleId: byName("Dig Through Time").oracleId, quantity: 2 },
        {
          scryfallId: trainer?.scryfallId.toUpperCase(),
          quantity: 1,
          foil: true,
          language: "Japanese",
        },
        { name: "sol ring", quantity: 1 },
        { name: "Grizzled Angler", quantity: 1 },
        { name: "Carta Que No Existe", quantity: 1 },
      ],
      { cards, collection },
    );
    expect(res.added.map((a) => [a.card.name, a.quantity, a.foil])).toEqual([
      ["Dig Through Time", 2, false],
      ["Thundertrap Trainer", 1, true],
      ["Sol Ring", 1, false],
      ["Grizzled Angler // Grisly Anglerfish", 1, false],
    ]);
    // "Sol Ring" también es un token: se elige la carta de juego.
    expect(res.added[2]?.card.layout).toBe("normal");
    expect(res.added.map((a) => a.language)).toEqual([null, "ja", null, null]);
    expect(res.notFound).toEqual(["Carta Que No Existe"]);
    expect((await collection.ownedQuantities()).get(byName("Dig Through Time").oracleId)).toBe(2);
  });

  it("las cartas añadidas a mano sobreviven a reimportar el CSV", async () => {
    const collection = new PrismaCollectionRepository(db, "u1");
    const sol = byName("Sol Ring");
    await collection.replaceCollection({
      matched: [
        {
          row: csvRow("Sol Ring", 3, 2, "c21"),
          oracleId: sol.oracleId,
          scryfallId: null,
          method: "name",
        },
      ],
      unmatched: [],
    });
    // 3 del CSV + 1 añadida a mano en el test anterior
    expect((await collection.ownedQuantities()).get(sol.oracleId)).toBe(4);
    const entries = await collection.entries();
    expect(entries.filter((e) => e.source === "manual")).toHaveLength(4);
    expect(entries.filter((e) => e.source === "csv")).toHaveLength(1);
  });

  it("solo se borran las añadidas a mano y del propio usuario", async () => {
    const mine = new PrismaCollectionRepository(db, "u1");
    const other = new PrismaCollectionRepository(db, "u2");
    const entries = await mine.entries();
    const manual = entries.find((e) => e.source === "manual");
    const csv = entries.find((e) => e.source === "csv");
    expect(await other.removeAdded(manual?.id ?? "")).toBe(false);
    expect(await mine.removeAdded(csv?.id ?? "")).toBe(false);
    expect(await mine.removeAdded("no-es-un-id")).toBe(false);
    expect(await mine.removeAdded(manual?.id ?? "")).toBe(true);
    expect(await mine.entries()).toHaveLength(entries.length - 1);
  });

  it("sin cuenta no guarda nada en la BD", async () => {
    const before = await db.collectionEntry.count();
    const res = await addToCollection([{ name: "Mana Crypt", quantity: 1 }], {
      cards,
      collection: new BrowserCollectionRepository(),
    });
    expect(res.added.map((a) => a.card.name)).toEqual(["Mana Crypt"]);
    expect(await db.collectionEntry.count()).toBe(before);
  });
});

describe("collectionView", () => {
  it("agrupa por carta con copias, foil, ediciones, origen y mazos que la usan", async () => {
    const collection = new PrismaCollectionRepository(db, "u1");
    const decks = new PrismaDeckRepository(db, "u1");
    const sol = byName("Sol Ring");
    await decks.save({
      name: "Teferi",
      input: "",
      source: "text",
      theme: null,
      commanders: [{ oracleId: byName("Teferi, Temporal Archmage").oracleId, name: "Teferi" }],
      cards: [{ oracleId: sol.oracleId, quantity: 1 }],
      locked: [],
      excluded: [],
    });
    const view = await collectionView({
      cards,
      collection,
      decks,
      classifier: new HeuristicRoleClassifier(),
    });
    const solView = view.find((v) => v.card.oracleId === sol.oracleId);
    // 3 del CSV + 1 añadida a mano
    expect(solView).toMatchObject({
      quantity: 4,
      fromCsv: 3,
      sets: ["C21"],
      usedIn: ["Teferi"],
      inUse: 1,
    });
    expect(solView?.roles.primary).toBe("ramp");
    // Sin impresión conocida (emparejadas por nombre), cada copia va a la más barata (0,80 €).
    expect(solView).toMatchObject({ price: 0.8, value: 3.2 });
    const trainer = view.find((v) => v.card.name === "Thundertrap Trainer");
    expect(trainer).toMatchObject({ quantity: 1, foilQuantity: 1, fromCsv: 0 });
    expect(trainer?.manual).toHaveLength(1);
    // El idioma de cada copia: el CSV trae "en"; la del escáner se añadió en japonés.
    expect(solView?.languages).toEqual([{ language: "en", quantity: 3 }]);
    expect(trainer?.languages).toEqual([{ language: "ja", quantity: 1 }]);
    expect(trainer?.manual[0]?.language).toBe("ja");
  });

  it("con impresión conocida, cada copia vale lo de su impresión (foil si es foil)", async () => {
    const trainer = byName("Thundertrap Trainer");
    await db.printing.updateMany({
      where: { oracleId: trainer.oracleId },
      data: { priceEur: 0.1, priceEurFoil: 2.5 },
    });
    const view = await collectionView({
      cards,
      collection: new PrismaCollectionRepository(db, "u1"),
      decks: new PrismaDeckRepository(db, "u1"),
      classifier: new HeuristicRoleClassifier(),
    });
    // La copia se añadió por su Scryfall ID y en foil.
    expect(view.find((v) => v.card.oracleId === trainer.oracleId)).toMatchObject({
      price: 0.1,
      value: 2.5,
    });
    // Y se enseña esa impresión, no la de referencia de la carta.
    const printing = fixturePrintings().find((p) => p.oracleId === trainer.oracleId);
    expect(
      view.find((v) => v.card.oracleId === trainer.oracleId)?.printing?.scryfallId.toLowerCase(),
    ).toBe(printing?.scryfallId.toLowerCase());
    // Sin impresión conocida, ninguna.
    expect(view.find((v) => v.card.name === "Sol Ring")?.printing).toBeNull();
  });

  it("por variante (como ManaBox): una fila por edición, foil, idioma y estado", async () => {
    const deps = {
      cards,
      collection: new PrismaCollectionRepository(db, "u1"),
      decks: new PrismaDeckRepository(db, "u1"),
      classifier: new HeuristicRoleClassifier(),
    };
    const sol = byName("Sol Ring");
    const byCard = (await collectionView(deps)).filter((v) => v.card.oracleId === sol.oracleId);
    const byCopy = (await collectionView(deps, "copy")).filter(
      (v) => v.card.oracleId === sol.oracleId,
    );
    expect(byCard).toHaveLength(1);
    expect(byCard[0]?.variant).toBeNull();
    // Las 3 del CSV (en inglés) y la añadida a mano (sin idioma) van por separado.
    expect(byCopy.length).toBeGreaterThan(1);
    expect(byCopy.reduce((n, v) => n + v.quantity, 0)).toBe(byCard[0]?.quantity);
    expect(new Set(byCopy.map((v) => v.key)).size).toBe(byCopy.length);
    expect(byCopy.every((v) => v.variant !== null)).toBe(true);
  });

  it("sin cuenta usa la colección que manda el navegador", async () => {
    const view = await collectionView({
      cards,
      collection: new BrowserCollectionRepository([[byName("Mana Crypt").oracleId, 2]]),
      decks: noSavedDecks,
      classifier: new HeuristicRoleClassifier(),
    });
    expect(view.map((v) => [v.card.name, v.quantity])).toEqual([["Mana Crypt", 2]]);
  });
});

describe("búsqueda de cartas por nombre", () => {
  it("sin tildes ni mayúsculas, primero las que empiezan así y sin tokens", async () => {
    expect((await cards.searchByName("SOL", 5)).map((c) => `${c.name}|${c.layout}`)).toEqual([
      "Sol Ring|normal",
    ]);
    const ang = await cards.searchByName("angler", 5);
    expect(ang.map((c) => c.name)).toEqual(["Grizzled Angler // Grisly Anglerfish"]);
    expect(await cards.searchByName("   ", 5)).toEqual([]);
  });
});

describe("editar la colección sin ManaBox", () => {
  it("ver, editar (también lo del CSV), cambiar de edición, borrar y exportar", async () => {
    await createTestUser(db, "u3");
    const collection = new PrismaCollectionRepository(db, "u3");
    const deps = { cards, collection };
    const sol = byName("Sol Ring");
    await collection.replaceCollection({
      matched: [
        {
          row: csvRow("Sol Ring", 3, 2, "c21"),
          oracleId: sol.oracleId,
          scryfallId: null,
          method: "name",
        },
      ],
      unmatched: [],
    });
    const [line] = await collectionLines(sol.oracleId, deps);
    expect(line).toMatchObject({ quantity: 3, source: "csv", language: "en" });

    // Otro usuario no la puede tocar.
    expect(
      await editCollectionLine(
        line!.id,
        { quantity: 1 },
        { cards, collection: new PrismaCollectionRepository(db, "u2") },
      ),
    ).toBe(false);

    const solPrinting = fixturePrintings().find((p) => p.oracleId === sol.oracleId)!;
    const other = fixturePrintings().find((p) => p.oracleId !== sol.oracleId)!;
    await expect(
      editCollectionLine(line!.id, { scryfallId: other.scryfallId }, deps),
    ).rejects.toBeInstanceOf(InvalidPrintingError);
    expect(
      await editCollectionLine(
        line!.id,
        {
          quantity: 2,
          foil: true,
          language: "Japanese",
          condition: "LP",
          scryfallId: solPrinting.scryfallId,
        },
        deps,
      ),
    ).toBe(true);
    const [edited] = await collectionLines(sol.oracleId, deps);
    expect(edited).toMatchObject({
      quantity: 2,
      foil: true,
      language: "ja",
      condition: "lightly_played",
      scryfallId: solPrinting.scryfallId.toLowerCase(),
      setCode: solPrinting.setCode,
      // Editada aquí: ya no es del CSV, así que reimportar no la pisa.
      source: "manual",
    });
    expect(edited?.printing?.scryfallId).toBe(solPrinting.scryfallId);

    const { csv, lines } = await exportCollectionCsv(deps);
    expect(lines).toBe(1);
    const back = parseManaboxCsv(csv).rows;
    expect(back.map((r) => [r.name, r.quantity, r.foil, r.language, r.condition])).toEqual([
      ["Sol Ring", 2, true, "ja", "lightly_played"],
    ]);

    expect(await editCollectionLine(line!.id, { quantity: 0 }, deps)).toBe(true);
    expect(await collectionLines(sol.oracleId, deps)).toEqual([]);
  });
});
