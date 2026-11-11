import { describe, expect, it } from "vitest";
import { shoppingList } from "./shopping";

describe("lista de la compra de todos los mazos", () => {
  it("lo que piden los mazos menos lo que tengo, sin básicas", () => {
    const items = shoppingList({
      usage: new Map([
        ["sol", { quantity: 2, decks: ["A", "B"], deckIds: ["a", "b"] }],
        ["crypt", { quantity: 1, decks: ["A"], deckIds: ["a"] }],
        ["island", { quantity: 40, decks: ["A", "B"] }],
        ["owned", { quantity: 1, decks: ["B"] }],
      ]),
      owned: new Map([
        ["sol", 1],
        ["owned", 3],
      ]),
      basics: new Set(["island"]),
    });
    expect(items).toEqual([
      {
        oracleId: "sol",
        quantity: 1,
        decks: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
      },
      { oracleId: "crypt", quantity: 1, decks: [{ id: "a", name: "A" }] },
    ]);
  });
});
