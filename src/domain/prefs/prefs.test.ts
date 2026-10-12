import { describe, expect, it } from "vitest";
import { isPrefKey, validPrefValue } from "./prefs";

describe("preferencias", () => {
  it("solo acepta claves conocidas", () => {
    expect(isPrefKey("collection")).toBe(true);
    expect(isPrefKey("__proto__")).toBe(false);
  });
  it("solo guarda objetos pequeños", () => {
    expect(validPrefValue({ sort: "valor", dir: "desc" })).toBe(true);
    expect(validPrefValue([1, 2])).toBe(false);
    expect(validPrefValue("x")).toBe(false);
    expect(validPrefValue(null)).toBe(false);
    expect(validPrefValue({ big: "x".repeat(5000) })).toBe(false);
  });
});
