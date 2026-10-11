import { describe, expect, it } from "vitest";
import {
  balanceTrade,
  buildTradeCopies,
  copiesValue,
  priceItems,
  proposeTrade,
  tradeBalance,
  tradeTolerance,
  type TradeCopy,
} from "./proposal";

const copy = (
  oracleId: string,
  unitPrice: number | null,
  over: Partial<TradeCopy> = {},
): TradeCopy => ({
  oracleId,
  scryfallId: null,
  foil: false,
  language: "en",
  quantity: 1,
  unitPrice,
  ...over,
});

describe("buildTradeCopies", () => {
  it("de las copias libres ofrece las de más valor (las baratas se suponen en los mazos)", () => {
    const prices: Record<string, number> = { "sol|a|": 1, "sol|b|f": 8, "sol|c|": 3 };
    const copies = buildTradeCopies({
      owned: [
        { oracleId: "sol", scryfallId: "a", foil: false, language: "en", quantity: 2 },
        { oracleId: "sol", scryfallId: "b", foil: true, language: "en", quantity: 1 },
        { oracleId: "sol", scryfallId: "c", foil: false, language: "ja", quantity: 1 },
        { oracleId: "crypt", scryfallId: null, foil: false, language: null, quantity: 1 },
      ],
      // 4 Sol Ring, 2 libres; Mana Crypt no está en "para cambiar".
      tradelist: [{ oracleId: "sol", quantity: 2 }],
      priceOf: (c) => prices[`${c.oracleId}|${c.scryfallId}|${c.foil ? "f" : ""}`] ?? null,
    });
    expect(copies.map((c) => [c.scryfallId, c.foil, c.quantity, c.unitPrice])).toEqual([
      ["b", true, 1, 8],
      ["c", false, 1, 3],
    ]);
  });

  it("junta las líneas repetidas de la misma copia", () => {
    const copies = buildTradeCopies({
      owned: [
        { oracleId: "x", scryfallId: "a", foil: false, language: "en", quantity: 1 },
        { oracleId: "x", scryfallId: "A", foil: false, language: "en", quantity: 2 },
      ],
      tradelist: [{ oracleId: "x", quantity: 3 }],
      priceOf: () => 2,
    });
    expect(copies).toEqual([
      {
        oracleId: "x",
        scryfallId: "a",
        foil: false,
        language: "en",
        quantity: 3,
        unitPrice: 2,
      },
    ]);
  });
});

describe("proposeTrade", () => {
  it("cruza las listas y cada uno da sus copias más baratas", () => {
    const sides = proposeTrade({
      myWishlist: [{ oracleId: "crypt", quantity: 1 }],
      myCopies: [
        copy("bolt", 5, { foil: true }),
        copy("bolt", 0.5, { quantity: 3 }),
        copy("ring", 1),
      ],
      theirWishlist: [
        { oracleId: "bolt", quantity: 2 },
        { oracleId: "nada", quantity: 1 },
      ],
      theirCopies: [copy("crypt", 120), copy("otra", 1)],
    });
    expect(sides.give).toEqual([copy("bolt", 0.5, { quantity: 2 })]);
    expect(sides.get).toEqual([copy("crypt", 120)]);
  });
});

describe("balance", () => {
  it("tolerancia: 5 % del lado que más vale o 1 €", () => {
    expect(tradeTolerance(10, 4)).toBe(1);
    expect(tradeTolerance(100, 90)).toBe(5);
  });

  it("dice si está cuadrado y cuánto sale ganando quien recibe", () => {
    const b = tradeBalance({ give: [copy("a", 10)], get: [copy("b", 10.8)] });
    expect(b).toEqual({ giveValue: 10, getValue: 10.8, diff: 0.8, tolerance: 1, balanced: true });
  });

  it("quita del lado que vale más la copia más cara que no se pasa", () => {
    const sides = balanceTrade({
      give: [copy("a", 10), copy("b", 6), copy("c", 3, { quantity: 2 })],
      get: [copy("x", 9)],
    });
    // Doy 22 y recibo 9: sobran 13. Quita a (10 ≤ 13 + 1,1) → doy 12; sobran 3: quita una c.
    expect(sides.give).toEqual([copy("b", 6), copy("c", 3)]);
    expect(tradeBalance(sides).balanced).toBe(true);
  });

  it("nunca deja un lado vacío", () => {
    const sides = balanceTrade({ give: [copy("a", 1)], get: [copy("crypt", 150)] });
    expect(sides.get).toHaveLength(1);
    expect(tradeBalance(sides).balanced).toBe(false);
  });

  it("si no puede cuadrar sin pasarse, para y deja la diferencia", () => {
    // Quitar la de 50 sería pasarse al otro lado más que la tolerancia: no se toca.
    const sides = balanceTrade({ give: [copy("a", 50)], get: [copy("x", 10)] });
    expect(copiesValue(sides.give)).toBe(50);
    const kept = balanceTrade({ give: [copy("a", 50)], get: [copy("x", 45)] });
    expect(kept.give).toHaveLength(1);
    expect(tradeBalance(kept).diff).toBe(-5);
  });
});

describe("priceItems", () => {
  it("pone el precio de la copia y avisa de lo que no está disponible", () => {
    const available = [copy("a", 2, { scryfallId: "p1", quantity: 2 }), copy("b", 1)];
    const r = priceItems(
      [
        { oracleId: "a", scryfallId: "P1", foil: false, language: "en", quantity: 2 },
        { oracleId: "b", scryfallId: null, foil: true, language: "en", quantity: 1 },
        { oracleId: "b", scryfallId: null, foil: false, language: "en", quantity: 0 },
      ],
      available,
    );
    expect(r.items).toEqual([copy("a", 2, { scryfallId: "p1", quantity: 2 })]);
    expect(r.problems).toEqual([{ key: "b||f|en", oracleId: "b", wanted: 1, available: 0 }]);
  });
});
