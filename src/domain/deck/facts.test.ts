import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { deckFacts, normalizeIdentity } from "./facts";

describe("deckFacts", () => {
  it("identidad de los comandantes en orden WUBRG y bracket estimado", () => {
    const facts = deckFacts(
      [
        makeCard({ name: "A", colorIdentity: ["R"] }),
        makeCard({ name: "B", colorIdentity: ["W"] }),
      ],
      [{ card: makeCard({ name: "Rhystic Study", gameChanger: true }), quantity: 1 }],
    );
    expect(facts).toEqual({ colorIdentity: "WR", bracket: 3 });
    expect(deckFacts([makeCard({ name: "Karn" })], []).colorIdentity).toBe("");
  });

  it("normaliza letras de colores", () => {
    expect(normalizeIdentity("rw")).toBe("WR");
    expect(normalizeIdentity("GxBg")).toBe("BG");
  });
});
