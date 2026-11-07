import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import type { ScoredCard } from "./engine";
import { swapReason } from "./reason";

const scored = (name: string, primary: ScoredCard["roles"]["primary"], inclusion: number) =>
  ({
    card: makeCard({ name }),
    roles: { roles: [primary], primary },
    synergy: 0.1,
    inclusion,
    inEdhrec: true,
    score: 0,
  }) as unknown as ScoredCard;

const swap = {
  out: scored("Mind Stone", "ramp", 0.2),
  in: scored("Rhystic Study", "draw", 0.6),
  sameRole: false,
  fillsDeficit: ["draw" as const],
};
const ctx = { counts: { draw: 10 } as never, minimums: { draw: 10 } };

describe("swapReason", () => {
  it("en español por defecto", () => {
    expect(swapReason(swap, ctx, "La tienes en tu colección.")).toBe(
      "Sustituye a Mind Stone (ramp, 20 % inclusión) por Rhystic Study (robo, 60 % inclusión, +10 synergy). La tienes en tu colección. Cambia ramp por robo. Sube robo a 10 (mínimo 10).",
    );
  });
  it("en inglés", () => {
    expect(swapReason(swap, ctx, "It's in your collection.", "en")).toBe(
      "Replace Mind Stone (ramp, 20% inclusion) with Rhystic Study (draw, 60% inclusion, +10 synergy). It's in your collection. Trades ramp for draw. Brings draw up to 10 (minimum 10).",
    );
  });
});
