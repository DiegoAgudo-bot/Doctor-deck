import { describe, expect, it } from "vitest";
import { statValue, subtypesOf } from "./attributes";

describe("statValue", () => {
  it("números, asteriscos y vacíos", () => {
    expect(statValue("3")).toBe(3);
    expect(statValue("*")).toBe(0);
    expect(statValue("1+*")).toBe(1);
    expect(statValue("-1")).toBe(-1);
    expect(statValue("X")).toBe(0);
    expect(statValue(null)).toBeNull();
    expect(statValue("")).toBeNull();
  });
});

describe("subtypesOf", () => {
  it("lo que va tras la raya, de todas las caras", () => {
    expect(subtypesOf("Legendary Creature — Elf Druid")).toBe("Elf Druid");
    expect(subtypesOf("Artifact")).toBe("");
    expect(subtypesOf("Creature — Human // Creature — Werewolf")).toBe("Human Werewolf");
  });
});
