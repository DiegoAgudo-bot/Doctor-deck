import { describe, expect, it } from "vitest";
import { commanderSlug, edhrecSlug, isValidThemeSlug } from "./slug";

describe("edhrecSlug", () => {
  it.each([
    ["Atraxa, Praetors' Voice", "atraxa-praetors-voice"],
    ["Ghave, Guru of Spores", "ghave-guru-of-spores"],
    ["Lim-Dûl the Necromancer", "lim-dul-the-necromancer"],
    ["Urza, Lord High Artificer", "urza-lord-high-artificer"],
    ["Esika, God of the Tree // The Prismatic Bridge", "esika-god-of-the-tree"],
    ["Y’shtola, Night’s Blessed", "yshtola-nights-blessed"],
    ["  K'rrik, Son of Yawgmoth ", "krrik-son-of-yawgmoth"],
  ])("%s → %s", (name, slug) => {
    expect(edhrecSlug(name)).toBe(slug);
  });
});

describe("commanderSlug", () => {
  it("une parejas en orden alfabético", () => {
    expect(commanderSlug(["Tymna the Weaver", "Thrasios, Triton Hero"])).toBe(
      "thrasios-triton-hero-tymna-the-weaver",
    );
  });
  it("exige al menos un comandante", () => {
    expect(() => commanderSlug([])).toThrow();
  });
});

describe("isValidThemeSlug", () => {
  it("acepta slugs y rechaza rutas raras", () => {
    expect(isValidThemeSlug("counters")).toBe(true);
    expect(isValidThemeSlug("plus-1-plus-1-counters")).toBe(true);
    expect(isValidThemeSlug("../cards")).toBe(false);
    expect(isValidThemeSlug("Counters")).toBe(false);
  });
});
