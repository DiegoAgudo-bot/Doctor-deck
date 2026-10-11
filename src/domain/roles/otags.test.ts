import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { HeuristicRoleClassifier } from "./heuristic-classifier";
import { withTaggerRoles } from "./otags";

const classifier = withTaggerRoles(new HeuristicRoleClassifier());

describe("withTaggerRoles", () => {
  it("sin etiquetas, lo mismo que las heurísticas", () => {
    const card = makeCard({ name: "Bicho", typeLine: "Creature — Bear", oracleText: "" });
    expect(classifier.classify(card)).toEqual({ roles: ["synergy"], primary: "synergy" });
  });

  it("una carta que las heurísticas no ven pasa a tener el rol de Tagger", () => {
    // Texto que la regex de removal no reconoce, pero Tagger sí la marca como removal.
    const card = makeCard({
      name: "Rara",
      typeLine: "Sorcery",
      oracleText: "Target creature's owner shuffles it into their library.",
      otags: ["removal", "etiqueta-que-no-usamos"],
    });
    expect(classifier.classify(card)).toEqual({ roles: ["removal"], primary: "removal" });
  });

  it("suma roles sin cambiar el principal de las heurísticas", () => {
    const card = makeCard({
      name: "Cultivate",
      typeLine: "Sorcery",
      oracleText:
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      otags: ["ramp", "draw"],
    });
    const r = classifier.classify(card);
    expect(r.primary).toBe("ramp");
    expect(r.roles).toEqual(["ramp", "draw"]);
  });

  it("no toca las tierras", () => {
    const card = makeCard({
      name: "Ancient Tomb",
      typeLine: "Land",
      oracleText: "{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.",
      otags: ["ramp"],
    });
    expect(classifier.classify(card)).toEqual({ roles: ["land"], primary: "land" });
  });
});
