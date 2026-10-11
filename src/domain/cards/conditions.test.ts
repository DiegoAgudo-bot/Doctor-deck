import { describe, expect, it } from "vitest";
import { conditionShort, normalizeCondition } from "./conditions";

describe("normalizeCondition", () => {
  it("acepta los valores de ManaBox y las abreviaturas habituales", () => {
    expect(normalizeCondition("near_mint")).toBe("near_mint");
    expect(normalizeCondition("NM")).toBe("near_mint");
    expect(normalizeCondition("Lightly Played")).toBe("lightly_played");
    expect(normalizeCondition("moderately_played")).toBe("played");
    expect(normalizeCondition("damaged")).toBe("poor");
    expect(normalizeCondition("")).toBeNull();
    expect(normalizeCondition("nuevo")).toBeNull();
    expect(conditionShort("lightly_played")).toBe("LP");
  });
});
