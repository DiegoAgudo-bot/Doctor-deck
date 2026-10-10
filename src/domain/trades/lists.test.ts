import { describe, expect, it } from "vitest";
import { buildTradelist, buildWishlist, listValue, matchTrades } from "./lists";

const usage = (entries: [string, number][]) =>
  new Map(entries.map(([id, quantity]) => [id, { quantity, decks: ["Mazo"] }]));

describe("buildWishlist", () => {
  it("lo que falta para los mazos marcados, y lo manual sin sumar dos veces", () => {
    const w = buildWishlist({
      manual: [
        { oracleId: "crypt", quantity: 1 },
        { oracleId: "rhystic", quantity: 2 },
      ],
      // Los marcados piden Sol Ring ×1, Crypt ×1, Rhystic ×1, Isla ×30.
      markedDecks: new Map([
        ["sol", 1],
        ["crypt", 1],
        ["rhystic", 1],
        ["island", 30],
      ]),
      // Todos mis mazos piden 2 Sol Ring (uno en un mazo no marcado).
      usage: usage([
        ["sol", 2],
        ["crypt", 1],
        ["rhystic", 1],
        ["island", 30],
      ]),
      owned: new Map([["sol", 1]]),
      basics: new Set(["island"]),
    });
    expect(w).toEqual([
      // Tengo 1 Sol Ring y mis mazos piden 2: falta 1 (el marcado pide 1).
      { oracleId: "sol", quantity: 1, manual: 0, forDecks: 1 },
      { oracleId: "crypt", quantity: 1, manual: 1, forDecks: 1 },
      { oracleId: "rhystic", quantity: 2, manual: 2, forDecks: 1 },
    ]);
  });

  it("si tengo de sobra, no falta nada", () => {
    expect(
      buildWishlist({
        manual: [],
        markedDecks: new Map([["sol", 1]]),
        usage: usage([["sol", 1]]),
        owned: new Map([["sol", 3]]),
        basics: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("buildTradelist", () => {
  it("las copias libres, sin básicas ni las que guardo", () => {
    expect(
      buildTradelist({
        owned: new Map([
          ["sol", 3],
          ["crypt", 1],
          ["island", 40],
          ["ring", 2],
        ]),
        usage: usage([
          ["sol", 1],
          ["crypt", 1],
        ]),
        keep: new Set(["ring"]),
        basics: new Set(["island"]),
      }),
    ).toEqual([{ oracleId: "sol", quantity: 2 }]);
  });
});

describe("matchTrades", () => {
  it("lo que tiene el otro que quiero y lo que quiere que tengo", () => {
    const m = matchTrades(
      {
        wishlist: [
          { oracleId: "crypt", quantity: 1 },
          { oracleId: "tithe", quantity: 2 },
        ],
        tradelist: [{ oracleId: "sol", quantity: 2 }],
      },
      {
        wishlist: [{ oracleId: "sol", quantity: 5 }],
        tradelist: [
          { oracleId: "tithe", quantity: 1 },
          { oracleId: "other", quantity: 1 },
        ],
      },
    );
    expect(m).toEqual({
      theyHave: [{ oracleId: "tithe", quantity: 1 }],
      theyWant: [{ oracleId: "sol", quantity: 2 }],
    });
    expect(listValue(m.theyHave, new Map([["tithe", 25.5]]))).toBe(25.5);
  });
});
