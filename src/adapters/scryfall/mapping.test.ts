import { describe, expect, it } from "vitest";
import { fixtureCards, fixturePrintings } from "../../../tests/helpers/scryfall-fixtures";
import { scryfallCardSchema, toCard, toPrinting } from "./mapping";

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
});
