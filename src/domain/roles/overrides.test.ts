import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { normalizeOverride, withOverrides } from "./overrides";
import { roleFromTag, splitTags } from "./tags";
import type { RoleClassifier } from "./types";

const base: RoleClassifier = { classify: () => ({ roles: ["synergy"], primary: "synergy" }) };

describe("correcciones de roles", () => {
  const card = makeCard({ name: "Carta" });
  const other = makeCard({ name: "Otra" });

  it("las mías mandan sobre las de la lista, y estas sobre las automáticas", () => {
    const c = withOverrides(base, {
      mine: new Map([[card.oracleId, { roles: ["ramp"], primary: "ramp" }]]),
      list: new Map([
        [card.oracleId, { roles: ["draw"], primary: "draw" }],
        [other.oracleId, { roles: ["removal", "draw"], primary: "removal" }],
      ]),
    });
    expect(c.classify(card)).toEqual({ roles: ["ramp"], primary: "ramp" });
    expect(c.sourceOf(card)).toBe("mine");
    expect(c.classify(other).primary).toBe("removal");
    expect(c.sourceOf(other)).toBe("list");
    const third = makeCard({ name: "Tercera" });
    expect(c.classify(third)).toEqual({ roles: ["synergy"], primary: "synergy" });
    expect(c.sourceOf(third)).toBe("auto");
  });

  it("normaliza roles y principal", () => {
    expect(normalizeOverride(["draw", "ramp", "nada", "draw"], "draw")).toEqual({
      roles: ["ramp", "draw"],
      primary: "draw",
    });
    expect(normalizeOverride(["removal"], "ramp")).toEqual({
      roles: ["removal"],
      primary: "removal",
    });
    expect(normalizeOverride(["nada"])).toBeNull();
  });
});

describe("etiquetas", () => {
  it("reconoce roles en inglés y en español", () => {
    expect(roleFromTag("Board Wipe")).toBe("wipe");
    expect(roleFromTag("card-draw")).toBe("draw");
    expect(roleFromTag("Protección")).toBe("protection");
    expect(roleFromTag("wincon")).toBeNull();
  });

  it("separa roles y etiquetas libres", () => {
    expect(splitTags(["Draw", "Ramp", "wincon", "Wincon", "Treasure", "robo"])).toEqual({
      roles: ["ramp", "draw"],
      free: ["wincon", "Treasure"],
    });
  });
});
