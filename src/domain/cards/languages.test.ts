import { describe, expect, it } from "vitest";
import { languageLabel, normalizeLanguage } from "./languages";

describe("normalizeLanguage", () => {
  it("acepta los códigos de Scryfall sin importar mayúsculas", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage(" ES ")).toBe("es");
    expect(normalizeLanguage("zhs")).toBe("zhs");
  });

  it("acepta los nombres en inglés y alias habituales", () => {
    expect(normalizeLanguage("Japanese")).toBe("ja");
    expect(normalizeLanguage("Chinese Traditional")).toBe("zht");
    expect(normalizeLanguage("jp")).toBe("ja");
  });

  it("devuelve null si viene vacío o no se reconoce", () => {
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
    expect(normalizeLanguage("klingon")).toBeNull();
  });

  it("da el nombre en español", () => {
    expect(languageLabel("de")).toBe("alemán");
    expect(languageLabel("xx")).toBe("xx");
  });
});
