import { describe, expect, it } from "vitest";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { printingPrice } from "@/domain/cards/types";
import { scryfallCardSchema, toCard, toLocalizedRecord, toPrinting } from "./mapping";

const byName = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name);
  if (!c) throw new Error(`falta ${name} en el fixture`);
  return c;
};

describe("toCard", () => {
  it("mapea una carta normal", () => {
    expect(byName("Dig Through Time")).toMatchObject({
      manaCost: "{6}{U}{U}",
      cmc: 8,
      typeLine: "Instant",
      colorIdentity: ["U"],
      keywords: ["Delve"],
      legalCommander: true,
      isBasicLand: false,
      frontFaceName: null,
      edhrecRank: 1800,
    });
  });

  it("une las caras de una carta de dos caras", () => {
    const c = byName("Grizzled Angler // Grisly Anglerfish");
    expect(c.frontFaceName).toBe("Grizzled Angler");
    expect(c.manaCost).toBe("{2}{U}");
    expect(c.oracleText).toContain("\n//\n");
    expect(c.imageUrl).toMatch(/^https:\/\/cards\.scryfall\.io\//);
  });

  it("toma el oracle_id de las caras en cartas reversibles", () => {
    const c = byName("Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom");
    expect(c.oracleId).toMatch(/^00000000-/);
    expect(c.typeLine).toBe("Legendary Creature — Homunculus // Legendary Creature — Homunculus");
    expect(c.cmc).toBe(0);
  });

  it("detecta tierras básicas (incluidas las nevadas) y cartas prohibidas", () => {
    expect(byName("Island").isBasicLand).toBe(true);
    expect(byName("Snow-Covered Island").isBasicLand).toBe(true);
    expect(byName("Mana Crypt").legalCommander).toBe(false);
  });

  it("descarta objetos sin oracle_id", () => {
    const raw = scryfallCardSchema.parse({
      id: "x",
      name: "Rara",
      layout: "normal",
      set: "abc",
      collector_number: "1",
    });
    expect(toCard(raw)).toBeNull();
    expect(toPrinting(raw)).toBeNull();
  });
});

describe("toPrinting", () => {
  it("normaliza el código de set a minúsculas", () => {
    const p = fixturePrintings().find(
      (x) => x.scryfallId === "9cf3af94-b7c8-415c-a5a1-d89967fd0bba",
    );
    expect(p).toMatchObject({ setCode: "blb", collectorNumber: "78", lang: "en" });
  });

  it("guarda el nombre de la edición, la fecha y los precios normal y foil", () => {
    const raw = scryfallCardSchema.parse({
      id: "9cf3af94-b7c8-415c-a5a1-d89967fd0bba",
      oracle_id: "o",
      name: "X",
      layout: "normal",
      set: "BLB",
      set_name: "Bloomburrow",
      released_at: "2024-08-02",
      collector_number: "78",
      prices: { eur: "0.35", eur_foil: "0.49" },
    });
    expect(toPrinting(raw)).toMatchObject({
      setName: "Bloomburrow",
      releasedAt: "2024-08-02",
      priceEur: 0.35,
      priceEurFoil: 0.49,
    });
  });
});

describe("printingPrice", () => {
  const p = {
    scryfallId: "x",
    oracleId: "o",
    setCode: "s",
    collectorNumber: "1",
    lang: "en",
    imageUrl: null,
  };
  it("foil o normal, y si falta uno, el otro", () => {
    expect(printingPrice({ ...p, priceEur: 1, priceEurFoil: 3 }, true)).toBe(3);
    expect(printingPrice({ ...p, priceEur: 1, priceEurFoil: 3 }, false)).toBe(1);
    expect(printingPrice({ ...p, priceEur: null, priceEurFoil: 3 }, false)).toBe(3);
    expect(printingPrice({ ...p, priceEur: 1, priceEurFoil: null }, true)).toBe(1);
    expect(printingPrice(p, true)).toBeNull();
  });
});

describe("colores, fuerza, rareza y artista", () => {
  it("de la carta o, si tiene dos caras, de la primera (colores de todas)", () => {
    const raw = {
      id: "x1",
      oracle_id: "o1",
      name: "Front // Back",
      layout: "transform",
      set: "isd",
      collector_number: "51",
      rarity: "mythic",
      artist: "Someone",
      card_faces: [
        { name: "Front", type_line: "Creature — Human", power: "2", toughness: "3", colors: ["G"] },
        {
          name: "Back",
          type_line: "Creature — Werewolf",
          power: "4",
          toughness: "4",
          colors: ["R"],
        },
      ],
    };
    const card = scryfallCardSchema.parse(raw);
    expect(toCard(card)).toMatchObject({ colors: ["R", "G"], power: "2", toughness: "3" });
    expect(toPrinting(card)).toMatchObject({ rarity: "mythic", artist: "Someone" });
  });
});

describe("toLocalizedRecord (all_cards)", () => {
  it("en otro idioma: lo impreso, sin recordatorio; de dos caras, las dos", () => {
    expect(
      toLocalizedRecord({
        oracle_id: "o1",
        lang: "es",
        released_at: "2020-01-01",
        printed_name: "Ángel de Serra",
        printed_type_line: "Criatura — Ángel",
        printed_text: "Vuela. (Esta criatura no puede ser bloqueada.)",
      }),
    ).toEqual({
      kind: "localized",
      localization: {
        oracleId: "o1",
        lang: "es",
        name: "Ángel de Serra",
        typeLine: "Criatura — Ángel",
        text: "Vuela.",
        releasedAt: "2020-01-01",
      },
    });
    const dfc = toLocalizedRecord({
      oracle_id: "o2",
      lang: "de",
      card_faces: [
        { printed_name: "Vorne", printed_type_line: "Kreatur — Mensch", printed_text: "A" },
        { printed_name: "Hinten", printed_type_line: "Kreatur — Werwolf", printed_text: "B" },
      ],
    });
    expect(dfc).toMatchObject({
      localization: { name: "Vorne // Hinten", typeLine: "Kreatur — Mensch // Kreatur — Werwolf" },
    });
  });

  it("en inglés: sus habilidades; sin nombre impreso u oracle_id, nada", () => {
    expect(
      toLocalizedRecord({
        oracle_id: "o1",
        lang: "en",
        keywords: ["Flying"],
        oracle_text: "Flying",
      }),
    ).toEqual({ kind: "english", oracleId: "o1", keywords: ["Flying"], text: "Flying" });
    expect(toLocalizedRecord({ oracle_id: "o1", lang: "fr" })).toBeNull();
    expect(toLocalizedRecord({ lang: "fr", printed_name: "X" })).toBeNull();
  });
});
