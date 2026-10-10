import { describe, expect, it } from "vitest";
import { canOpenDeck, isListedDeck, toDeckVisibility } from "./visibility";

describe("visibilidad de mazos", () => {
  it("público y oculto se abren con el enlace; privado solo su dueño", () => {
    expect(canOpenDeck("public", "ana", null)).toBe(true);
    expect(canOpenDeck("unlisted", "ana", "beto")).toBe(true);
    expect(canOpenDeck("private", "ana", "beto")).toBe(false);
    expect(canOpenDeck("private", "ana", null)).toBe(false);
    expect(canOpenDeck("private", "ana", "ana")).toBe(true);
  });

  it("solo los públicos salen en listados", () => {
    expect(isListedDeck("public")).toBe(true);
    expect(isListedDeck("unlisted")).toBe(false);
    expect(isListedDeck("private")).toBe(false);
  });

  it("un valor desconocido de la BD cuenta como privado", () => {
    expect(toDeckVisibility("unlisted")).toBe("unlisted");
    expect(toDeckVisibility("raro")).toBe("private");
  });
});
