import { describe, expect, it } from "vitest";
import { curveByColor, curveSeg, deckSummary } from "./color-curve";

const c = (typeLine: string, cmc: number, colorIdentity: string[], quantity = 1) => ({
  card: { typeLine, cmc, colorIdentity },
  quantity,
});

describe("datos del mazo", () => {
  const cards = [
    c("Basic Land — Island", 0, ["U"], 30),
    c("Artifact", 1, []),
    c("Instant", 1, ["U"], 2),
    c("Creature — Elf", 1.5, ["G", "U"]),
    c("Sorcery", 9, ["R"]),
    c("Artifact Creature // Land", 3, ["W"]),
  ];

  it("apila la curva por color, sin tierras y con 7+ en la última columna", () => {
    const curve = curveByColor(cards);
    expect(curve.spells).toBe(6);
    expect(curve.columns[1]).toEqual({
      total: 4,
      segs: [
        { seg: "u", count: 2 },
        { seg: "m", count: 1 },
        { seg: "c", count: 1 },
      ],
    });
    expect(curve.columns[7]!.segs).toEqual([{ seg: "r", count: 1 }]);
    expect(curve.columns[3]!.total).toBe(1);
    expect(curve.max).toBe(4);
    expect(curve.used).toEqual(["w", "u", "r", "m", "c"]);
  });

  it("resume tierras, hechizos y coste medio", () => {
    const s = deckSummary(cards);
    expect(s.lands).toBe(30);
    expect(s.spells).toBe(6);
    expect(s.averageCmc).toBeCloseTo((1 + 2 + 1.5 + 9 + 3) / 6);
    expect(deckSummary([]).averageCmc).toBe(0);
  });

  it("un color desconocido cuenta como incoloro", () => {
    expect(curveSeg({ typeLine: "Artifact", cmc: 0, colorIdentity: ["X"] })).toBe("c");
  });
});
