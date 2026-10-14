import { describe, expect, it } from "vitest";
import { internalPath } from "./internal-path";

describe("internalPath", () => {
  it("deja pasar las rutas de la web con su query", () => {
    expect(internalPath("/decks")).toBe("/decks");
    expect(internalPath("/analyze?analyze=1&save=1")).toBe("/analyze?analyze=1&save=1");
    expect(internalPath("/groups/x?tab=y#top")).toBe("/groups/x?tab=y#top");
  });

  it("rechaza lo que acaba en otro dominio", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "https://evil.com",
      "evil.com",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(internalPath(bad)).toBeNull();
    }
  });
});
