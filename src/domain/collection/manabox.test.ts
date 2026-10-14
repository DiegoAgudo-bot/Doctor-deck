import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import {
  looksLikeCollectionCsv,
  ManaboxFormatError,
  parseManaboxCsv,
  toManaboxCsv,
} from "./manabox";

const HEADER =
  "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added";

describe("parseManaboxCsv con el export real", () => {
  const { rows, errors } = parseManaboxCsv(readFixture("manabox_sample.csv"));

  it("lee todas las filas sin errores", () => {
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(16);
  });

  it("tipa los campos", () => {
    expect(rows[0]).toMatchObject({
      line: 2,
      name: "Thundertrap Trainer",
      setCode: "blb",
      collectorNumber: "78",
      scryfallId: "9cf3af94-b7c8-415c-a5a1-d89967fd0bba",
      quantity: 1,
      foil: false,
      language: "en",
    });
  });

  it("respeta nombres con comas, foils, dos caras y cantidades > 1", () => {
    const satsuki = rows.find((r) => r.name === "Satsuki, the Living Lore");
    expect(satsuki?.foil).toBe(true);
    expect(rows.some((r) => r.name === "Marang River Regent // Coil and Catch")).toBe(true);
    expect(rows.find((r) => r.name === "Lantern Flare")?.quantity).toBe(2);
  });
});

describe("parseManaboxCsv: casos límite", () => {
  it("acepta filas sin Scryfall ID o con un ID mal formado", () => {
    const { rows } = parseManaboxCsv(
      `${HEADER}\nSol Ring,C21,Commander 2021,263,etched,uncommon,1,1,,1,false,false,false,near_mint,en,false,EUR,x\n` +
        `Sol Ring,C21,Commander 2021,263,normal,uncommon,1,1,no-es-un-uuid,1,false,false,false,near_mint,en,false,EUR,x`,
    );
    expect(rows.map((r) => [r.scryfallId, r.foil])).toEqual([
      [null, true],
      [null, false],
    ]);
  });

  it("normaliza el idioma (código de Scryfall o nombre en inglés)", () => {
    const { rows } = parseManaboxCsv(
      `${HEADER}\nSol Ring,C21,,263,normal,,1,,,,,,,,ES,,,\nSol Ring,C21,,263,normal,,1,,,,,,,,Japanese,,,\n` +
        `Sol Ring,C21,,263,normal,,1,,,,,,,,,,,`,
    );
    expect(rows.map((r) => r.language)).toEqual(["es", "ja", null]);
  });

  it("devuelve errores por fila con su número de línea", () => {
    const { rows, errors } = parseManaboxCsv(
      `${HEADER}\n,C21,,263,normal,,1,,,,,,,,,,,\nSol Ring,C21,,263,normal,,0,,,,,,,,,,,\nSol Ring,C21,,263,normal,,abc,,,,,,,,,,,`,
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => [e.line, e.reason])).toEqual([
      [2, "Fila sin nombre de carta"],
      [3, 'Cantidad inválida: "0"'],
      [4, 'Cantidad inválida: "abc"'],
    ]);
  });

  it("solo exige Name y Quantity", () => {
    const { rows } = parseManaboxCsv("Name,Quantity\nSol Ring,3");
    expect(rows[0]).toMatchObject({
      name: "Sol Ring",
      quantity: 3,
      setCode: null,
      scryfallId: null,
    });
  });

  it("rechaza CSV que no son de una colección", () => {
    expect(() => parseManaboxCsv("Foo,Bar\nSol Ring,1")).toThrow(ManaboxFormatError);
  });
});

describe("CSV de otras apps", () => {
  it("Moxfield: Count, Edition (código), Foil", () => {
    const { rows } = parseManaboxCsv(
      'Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Collector Number\n2,0,"Sol Ring",c21,Near Mint,English,foil,263',
    );
    expect(rows[0]).toMatchObject({
      name: "Sol Ring",
      quantity: 2,
      setCode: "c21",
      collectorNumber: "263",
      foil: true,
      language: "en",
      condition: "near_mint",
    });
  });

  it("Deckbox: Edition con el nombre (no es un código), Card Number", () => {
    const { rows } = parseManaboxCsv(
      "Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil\n1,0,Arcane Signet,Commander Masters,410,Near Mint,English,",
    );
    expect(rows[0]).toMatchObject({ setCode: null, collectorNumber: "410", foil: false });
  });

  it("Dragon Shield: sep=, Card Name, Set Code, Printing", () => {
    const { rows } = parseManaboxCsv(
      "sep=,\nFolder Name,Quantity,Trade Quantity,Card Name,Set Code,Set Name,Card Number,Condition,Printing,Language\nMain,3,0,Island,SLD,Secret Lair,1,NearMint,Foil,English",
    );
    expect(rows[0]).toMatchObject({ name: "Island", quantity: 3, setCode: "sld", foil: true });
  });

  it("detecta la cabecera de cualquiera de ellas", () => {
    expect(looksLikeCollectionCsv("Count,Name,Edition\n1,Sol Ring,c21")).toBe(true);
    expect(looksLikeCollectionCsv("sep=,\nCard Name,Quantity\nX,1")).toBe(true);
    expect(looksLikeCollectionCsv("1 Sol Ring\n1 Island")).toBe(false);
  });
});

describe("toManaboxCsv", () => {
  it("escribe el formato de ManaBox y se vuelve a leer igual", () => {
    const csv = toManaboxCsv([
      {
        name: "Ultros, Obnoxious Octopus",
        setCode: "fin",
        setName: "Final Fantasy",
        collectorNumber: "61",
        foil: true,
        quantity: 2,
        scryfallId: "9cf3af94-b7c8-415c-a5a1-d89967fd0bba",
        condition: "lightly_played",
        language: "ja",
        price: 1.5,
        addedAt: new Date("2026-10-01T00:00:00Z"),
      },
      {
        name: 'Carta "rara"',
        setCode: null,
        setName: null,
        collectorNumber: null,
        foil: false,
        quantity: 1,
        scryfallId: null,
        condition: null,
        language: null,
        price: null,
        addedAt: new Date("2026-10-02T00:00:00Z"),
      },
    ]);
    const { rows, errors } = parseManaboxCsv(csv);
    expect(errors).toEqual([]);
    expect(
      rows.map((r) => [r.name, r.setCode, r.foil, r.quantity, r.language, r.condition]),
    ).toEqual([
      ["Ultros, Obnoxious Octopus", "fin", true, 2, "ja", "lightly_played"],
      ['Carta "rara"', null, false, 1, "en", "near_mint"],
    ]);
    expect(rows[0]?.scryfallId).toBe("9cf3af94-b7c8-415c-a5a1-d89967fd0bba");
  });
});
