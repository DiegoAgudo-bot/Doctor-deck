import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { ManaboxFormatError, parseManaboxCsv } from "./manabox";

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

  it("rechaza CSV que no son de ManaBox", () => {
    expect(() => parseManaboxCsv("Card,Count\nSol Ring,1")).toThrow(ManaboxFormatError);
  });
});
