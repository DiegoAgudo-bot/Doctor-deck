import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { EMPTY_CATALOG_QUERY, type CatalogQuery } from "@/domain/cards/catalog-search";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { makeCard } from "../../tests/helpers/cards";
import { createTestDb } from "../../tests/helpers/test-db";
import { browseMyCollection } from "./collection-cards";
import { syncLocalizations, type LocalizedSourceRecord } from "./sync-localizations";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

const serra = makeCard({
  name: "Serra Angel",
  typeLine: "Creature — Angel",
  oracleText: "Flying\nVigilance",
  keywords: ["Flying", "Vigilance"],
  colorIdentity: ["W"],
  cmc: 5,
});
const roc = makeCard({
  name: "Roc Egg",
  typeLine: "Creature — Bird",
  oracleText: "Flying",
  keywords: ["Flying"],
  colorIdentity: ["W"],
});
const elf = makeCard({
  name: "Llanowar Elves",
  typeLine: "Creature — Elf Druid",
  oracleText: "{T}: Add {G}.",
  colorIdentity: ["G"],
});

const loc = (
  oracleId: string,
  lang: string,
  name: string,
  typeLine: string | null,
  text: string | null,
  releasedAt = "2020-01-01",
): LocalizedSourceRecord => ({
  kind: "localized",
  localization: { oracleId, lang, name, typeLine, text, releasedAt },
});

const RECORDS: LocalizedSourceRecord[] = [
  {
    kind: "english",
    oracleId: serra.oracleId,
    keywords: ["Flying", "Vigilance"],
    text: "Flying\nVigilance",
  },
  { kind: "english", oracleId: roc.oracleId, keywords: ["Flying"], text: "Flying" },
  loc(serra.oracleId, "es", "Ángel de Serra", "Criatura — Ángel", "Vuela.\nVigilancia"),
  // Una impresión vieja sin tipo: gana la de arriba.
  loc(serra.oracleId, "es", "Ángel de Serra", null, "Vuela.", "1995-01-01"),
  loc(serra.oracleId, "de", "Serra-Engel", "Kreatur — Engel", "Fliegend\nWachsamkeit"),
  loc(roc.oracleId, "es", "Huevo de roc", "Criatura — Ave", "Vuela."),
  loc(roc.oracleId, "de", "Roc-Ei", "Kreatur — Vogel", "Fliegend"),
  loc(elf.oracleId, "es", "Elfos de Llanowar", "Criatura — Elfo druida", "{T}: Agrega {G}."),
  loc(
    elf.oracleId,
    "ja",
    "ラノワールのエルフ",
    "クリーチャー — エルフ・ドルイド",
    "{T}：{G}を加える。",
  ),
];

const source = (updatedAt = "2026-10-16") => {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    updatedAt: async () => updatedAt,
    async *read() {
      reads += 1;
      yield* RECORDS;
      yield null;
    },
  };
};

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards([serra, roc, elf]);
});
afterAll(async () => cleanup());

const find = async (over: Partial<CatalogQuery>) =>
  (await cards.searchCatalog({ ...EMPTY_CATALOG_QUERY, sort: "name", ...over }, 0, 50)).cards.map(
    (c) => c.name,
  );

describe("syncLocalizations", () => {
  it("guarda una fila por carta e idioma y aprende las habilidades; luego no repite", async () => {
    const now = () => new Date("2026-10-16T10:00:00Z");
    const s = source();
    const r = await syncLocalizations(s, cards, { now });
    expect(r).toEqual({ status: "synced", rows: 6, aliases: 2 });
    const es = (await cards.findLocalizations([serra.oracleId]))
      .get(serra.oracleId)
      ?.find((l) => l.name.startsWith("Á"));
    expect(es).toMatchObject({ name: "Ángel de Serra", typeLine: "criatura — angel" });
    const aliases = (await cards.keywordAliases()).map((a) => `${a.keyword}:${a.alias}`).sort();
    expect(aliases).toEqual(["Flying:Fliegend", "Flying:Vuela"]);
    // Al día (menos de una semana): ni se lee.
    expect((await syncLocalizations(s, cards, { now })).status).toBe("fresh");
    expect(s.reads).toBe(1);
    // Pasada la semana, pero el fichero no ha cambiado: tampoco.
    const later = () => new Date("2026-10-30T10:00:00Z");
    expect((await syncLocalizations(s, cards, { now: later })).status).toBe("fresh");
    expect(s.reads).toBe(1);
  });

  it("el buscador encuentra por nombre, tipo, texto y habilidad en otros idiomas", async () => {
    expect((await cards.searchByName("ángel de", 10)).map((c) => c.name)).toEqual(["Serra Angel"]);
    expect((await cards.searchByName("ラノワール", 10)).map((c) => c.name)).toEqual([
      "Llanowar Elves",
    ]);
    expect(await find({ text: "huevo" })).toEqual(["Roc Egg"]);
    expect(await find({ subtype: "elfo" })).toEqual(["Llanowar Elves"]);
    expect(await find({ oracle: "agrega" })).toEqual(["Llanowar Elves"]);
    expect(await find({ keyword: "vuela" })).toEqual(["Roc Egg", "Serra Angel"]);
    expect(await find({ keyword: "volar" })).toEqual(["Roc Egg", "Serra Angel"]);
    expect(await find({ keyword: "fliegend" })).toEqual(["Roc Egg", "Serra Angel"]);
    expect(await find({ keyword: "Flying" })).toEqual(["Roc Egg", "Serra Angel"]);
  });

  it("y mi colección también", async () => {
    const user = await db.user.create({
      data: { id: "u1", email: "u1@example.com", name: "U", emailVerified: true },
    });
    const collection = new PrismaCollectionRepository(db, user.id);
    await collection.addCards(
      [serra, elf].map((c) => ({
        oracleId: c.oracleId,
        name: c.name,
        quantity: 1,
        foil: false,
        scryfallId: null,
        language: null,
        condition: null,
      })),
    );
    const deps = {
      cards,
      collection,
      decks: new PrismaDeckRepository(db, user.id),
      classifier: new HeuristicRoleClassifier(),
    };
    const browse = async (filters: object) =>
      (await browseMyCollection({ filters, sort: "nombre", offset: 0, limit: 10 }, deps)).items.map(
        (i) => i.card.name,
      );
    expect(await browse({ q: "angel de serra" })).toEqual(["Serra Angel"]);
    expect(await browse({ q: "elfo" })).toEqual(["Llanowar Elves"]);
    expect(await browse({ text: "agrega" })).toEqual(["Llanowar Elves"]);
    expect(await browse({ subtype: "druida" })).toEqual(["Llanowar Elves"]);
    expect(await browse({ keyword: "volar" })).toEqual(["Serra Angel"]);
    expect(await browse({ keyword: "vuela" })).toEqual(["Serra Angel"]);
  });
});
