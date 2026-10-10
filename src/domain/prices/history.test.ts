import { describe, expect, it } from "vitest";
import {
  collectionValueSeries,
  daysBefore,
  priceChange,
  priceDrop,
  priceMovers,
  type PricePoint,
} from "./history";

const h = (...points: [string, number][]): PricePoint[] =>
  points.map(([date, eur]) => ({ date, eur }));

describe("fechas", () => {
  it("resta días en UTC, también cambiando de mes y de año", () => {
    expect(daysBefore("2026-10-10", 7)).toBe("2026-10-03");
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
    expect(daysBefore("2026-01-05", 10)).toBe("2025-12-26");
  });
});

describe("priceChange", () => {
  it("compara el primer y el último día", () => {
    expect(priceChange(h(["2026-10-01", 10], ["2026-10-05", 8], ["2026-10-10", 12.5]))).toEqual({
      now: 12.5,
      before: 10,
      delta: 2.5,
      percent: 25,
    });
  });
  it("con un solo día no hay cambio; sin días, nada", () => {
    expect(priceChange(h(["2026-10-10", 3]))).toEqual({
      now: 3,
      before: null,
      delta: null,
      percent: null,
    });
    expect(priceChange([])).toBeNull();
  });
});

describe("priceMovers", () => {
  const histories = new Map([
    ["sube", h(["2026-10-01", 10], ["2026-10-10", 15])],
    ["baja", h(["2026-10-01", 40], ["2026-10-10", 30])],
    ["poco", h(["2026-10-01", 1], ["2026-10-10", 1.5])],
    ["igual", h(["2026-10-01", 5], ["2026-10-10", 5])],
    ["nueva", h(["2026-10-10", 99])],
  ]);
  it("ordena por lo que cambia el valor de mis copias", () => {
    const owned = new Map([
      ["sube", 1],
      ["baja", 1],
      ["poco", 20],
      ["igual", 3],
      ["nueva", 1],
    ]);
    const { up, down } = priceMovers(owned, histories, 5);
    // 20 copias × 0,50 € = 10 € pesan más que 1 copia × 5 €.
    expect(up.map((m) => [m.oracleId, m.valueDelta])).toEqual([
      ["poco", 10],
      ["sube", 5],
    ]);
    expect(down.map((m) => [m.oracleId, m.valueDelta, m.change.percent])).toEqual([
      ["baja", -10, -25],
    ]);
  });
});

describe("collectionValueSeries", () => {
  it("suma copias × precio cada día, arrastrando el último precio conocido", () => {
    const series = collectionValueSeries(
      new Map([
        ["a", 2],
        ["b", 1],
      ]),
      new Map([
        ["a", h(["2026-10-01", 10], ["2026-10-02", 11])],
        ["b", h(["2026-10-01", 5], ["2026-10-03", 6])],
      ]),
    );
    expect(series).toEqual(h(["2026-10-01", 25], ["2026-10-02", 27], ["2026-10-03", 28]));
  });
});

describe("priceDrop", () => {
  const history = h(["2026-09-20", 50], ["2026-10-01", 45], ["2026-10-10", 40]);
  it("avisa si baja el umbral respecto al máximo anterior", () => {
    expect(priceDrop("x", history, 20)).toEqual({
      oracleId: "x",
      now: 40,
      reference: 50,
      percent: 20,
    });
    expect(priceDrop("x", history, 25)).toBeNull();
  });
  it("sin días anteriores no hay con qué comparar", () => {
    expect(priceDrop("x", h(["2026-10-10", 1]), 1)).toBeNull();
  });
});
