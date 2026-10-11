import { describe, expect, it } from "vitest";
import { cleanComment, COMMENT_MAX_LENGTH, cooledDown } from "./comments";

describe("cleanComment", () => {
  it("recorta espacios y saltos de línea de más", () => {
    expect(cleanComment("  Buen mazo  \r\n\r\n\r\n\r\nMete Sol Ring \n")).toEqual({
      body: "Buen mazo\n\nMete Sol Ring",
    });
  });

  it("rechaza vacíos, demasiado largos y con muchos enlaces", () => {
    expect(cleanComment(" \n ")).toEqual({ problem: "empty" });
    expect(cleanComment("a".repeat(COMMENT_MAX_LENGTH + 1))).toEqual({ problem: "too_long" });
    expect(cleanComment("http://a https://b http://c")).toEqual({ problem: "too_many_links" });
    expect(cleanComment("mira https://moxfield.com/x")).toHaveProperty("body");
  });
});

describe("cooledDown", () => {
  it("deja pasar 15 s entre comentarios", () => {
    const t = new Date("2026-01-01T10:00:00Z");
    expect(cooledDown(null, t)).toBe(true);
    expect(cooledDown(new Date(t.getTime() - 5_000), t)).toBe(false);
    expect(cooledDown(new Date(t.getTime() - 15_000), t)).toBe(true);
  });
});
