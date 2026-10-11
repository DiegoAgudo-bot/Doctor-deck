import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { recommendationSections } from "./sections";
import type { ResolvedRecommendation } from "./types";

const rec = (
  name: string,
  categories: string[],
  inclusion: number | null,
  synergy: number | null = 0,
): ResolvedRecommendation => ({
  name,
  card: makeCard({ name }),
  categories,
  inclusion,
  synergy,
  numDecks: null,
  potentialDecks: null,
});

describe("recommendationSections", () => {
  it("agrupa por lista en el orden de EDHREC y ordena por inclusión y sinergia", () => {
    const sections = recommendationSections([
      rec("Sol Ring", ["topcards", "manaartifacts"], 0.9),
      rec("Rhystic Study", ["topcards", "enchantments"], 0.6),
      rec("Grapeshot", ["sorceries"], 0.2, 0.1),
      rec("Brainstorm", ["instants", "highsynergycards"], 0.4, 0.3),
      rec("Mind Stone", ["manaartifacts"], 0.5),
      rec("Rara", ["cosasraras"], 0.1),
      rec("Ponder", ["sorceries"], 0.2, 0.4),
    ]);
    expect(sections.map((s) => [s.label, s.cards.map((c) => c.name)])).toEqual([
      ["Alta sinergia", ["Brainstorm"]],
      ["Las más jugadas", ["Sol Ring", "Rhystic Study"]],
      ["Instantáneos", ["Brainstorm"]],
      ["Conjuros", ["Ponder", "Grapeshot"]],
      ["Artefactos de maná", ["Sol Ring", "Mind Stone"]],
      ["Encantamientos", ["Rhystic Study"]],
      ["cosasraras", ["Rara"]],
    ]);
  });
});
