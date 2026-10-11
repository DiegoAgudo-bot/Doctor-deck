import { describe, expect, it } from "vitest";
import { withLoans } from "./loans";

describe("withLoans", () => {
  it("las copias prestadas cuentan como ocupadas sin tocar los ids de mazo", () => {
    const usage = new Map([["bolt", { quantity: 1, decks: ["Krenko"], deckIds: ["d1"] }]]);
    const out = withLoans(usage, [
      { oracleId: "bolt", quantity: 2, to: "@ana" },
      { oracleId: "crypt", quantity: 1, to: "Juan" },
      { oracleId: "crypt", quantity: 1, to: "Juan" },
    ]);
    expect(out.get("bolt")).toEqual({
      quantity: 3,
      decks: ["Krenko", "Prestada a @ana"],
      deckIds: ["d1"],
    });
    expect(out.get("crypt")).toMatchObject({ quantity: 2, decks: ["Prestada a Juan"] });
    // No cambia el original.
    expect(usage.get("bolt")?.quantity).toBe(1);
  });
});
