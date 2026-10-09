import { describe, expect, it } from "vitest";
import { colorGroupName, suggestedDeckName, themeLabel } from "./naming";

describe("nombres de mazos", () => {
  it("nombra la identidad de color sin importar el orden", () => {
    expect(colorGroupName(["R", "W"])).toBe("Boros");
    expect(colorGroupName(["G", "R", "B"])).toBe("Jund");
    expect(colorGroupName(["U"])).toBe("Mono azul");
    expect(colorGroupName([])).toBe("Incoloro");
    expect(colorGroupName(["W", "U", "B", "R", "G"])).toBe("Cinco colores");
    expect(colorGroupName(["U", "B", "R", "G"])).toBe("Glint-Eye");
  });

  it("traduce los temas conocidos y deja los demás", () => {
    expect(themeLabel("Tokens")).toBe("Fichas");
    expect(themeLabel("+1/+1 Counters")).toBe("Contadores +1/+1");
    expect(themeLabel("Cats")).toBe("Cats");
  });

  it("colores - un par de palabras sobre el mazo", () => {
    expect(suggestedDeckName(["W", "R"], ["Tokens", "Extra Combats", "Aggro"], "Winota")).toBe(
      "Boros - Fichas y Combates extra",
    );
    expect(suggestedDeckName(["B", "R", "G"], ["Sacrifice"], "Korvold")).toBe("Jund - Sacrificio");
    expect(suggestedDeckName(["U"], [], "Talrand")).toBe("Mono azul - Talrand");
    // Dos temas que se traducen igual no se repiten.
    expect(suggestedDeckName(["W"], ["Enchantress", "Enchantments"], "X")).toBe(
      "Mono blanco - Encantamientos",
    );
  });
});
