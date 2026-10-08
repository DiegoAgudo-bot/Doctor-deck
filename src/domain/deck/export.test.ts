import { describe, expect, it } from "vitest";
import { parseDecklist } from "./decklist";
import { applySwaps, exportDecklist, type ExportableDeck } from "./export";

const deck: ExportableDeck = {
  commanders: [{ oracleId: "c", name: "Teferi, Temporal Archmage" }],
  cards: [
    { oracleId: "a", name: "Tamiyo's Logbook", quantity: 1 },
    { oracleId: "i", name: "Island", quantity: 30 },
    { oracleId: "b", name: "Body of Knowledge", quantity: 1 },
  ],
};

describe("applySwaps", () => {
  it("quita la que sale y mete la que entra", () => {
    const result = applySwaps(deck, [
      { outOracleId: "a", in: { oracleId: "d", name: "Dig Through Time" } },
    ]);
    expect(result.cards.map((c) => [c.name, c.quantity])).toEqual([
      ["Island", 30],
      ["Body of Knowledge", 1],
      ["Dig Through Time", 1],
    ]);
    expect(deck.cards[0]?.quantity).toBe(1); // no muta el original
  });

  it("ignora cambios cuya carta ya no está", () => {
    const result = applySwaps(deck, [{ outOracleId: "zzz", in: { oracleId: "d", name: "Dig" } }]);
    expect(result.cards).toHaveLength(3);
  });
});

describe("exportDecklist", () => {
  it("genera texto con secciones que el propio parser vuelve a leer", () => {
    const text = exportDecklist(deck);
    expect(text).toBe(
      "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Body of Knowledge\n30 Island\n1 Tamiyo's Logbook\n",
    );
    const parsed = parseDecklist(text);
    expect(parsed.entries.filter((e) => e.commander).map((e) => e.name)).toEqual([
      "Teferi, Temporal Archmage",
    ]);
    expect(parsed.entries.reduce((n, e) => n + e.quantity, 0)).toBe(33);
  });
});
