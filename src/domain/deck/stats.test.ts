import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { manaCurve } from "./stats";

describe("manaCurve", () => {
  it("agrupa por coste, excluye tierras y junta 7+", () => {
    const curve = manaCurve([
      { card: makeCard({ name: "Sol Ring", cmc: 1 }), quantity: 1 },
      { card: makeCard({ name: "Island", cmc: 0, typeLine: "Basic Land — Island" }), quantity: 30 },
      { card: makeCard({ name: "Dig Through Time", cmc: 8 }), quantity: 1 },
      { card: makeCard({ name: "Emrakul", cmc: 15 }), quantity: 1 },
      { card: makeCard({ name: "Ornithopter", cmc: 0 }), quantity: 2 },
      { card: makeCard({ name: "MDFC", cmc: 3, typeLine: "Instant // Land" }), quantity: 1 },
    ]);
    expect(curve).toEqual({ 0: 2, 1: 1, 2: 0, 3: 1, 4: 0, 5: 0, 6: 0, 7: 2 });
  });
});
