import { describe, expect, it } from "vitest";
import { isScryfallImagePath, localImageUrl, scryfallImagePath } from "./images";

const URL =
  "https://cards.scryfall.io/normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446";

describe("imágenes de cartas", () => {
  it("convierte las de Scryfall en nuestras, sin el parámetro de versión", () => {
    expect(scryfallImagePath(URL)).toBe(
      "normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg",
    );
    expect(localImageUrl(URL)).toBe(
      "/img/normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg",
    );
  });

  it("deja igual lo que no es una imagen de Scryfall", () => {
    expect(localImageUrl(null)).toBeNull();
    expect(localImageUrl("https://example.com/x.jpg")).toBe("https://example.com/x.jpg");
    expect(scryfallImagePath("https://cards.scryfall.io/normal/../../etc/passwd")).toBeNull();
  });

  it("solo acepta rutas con la forma de Scryfall", () => {
    expect(isScryfallImagePath("large/back/0/1/01234567-89ab-cdef-0123-456789abcdef.jpg")).toBe(
      true,
    );
    expect(isScryfallImagePath("normal/front/8/e/../../secret.jpg")).toBe(false);
    expect(isScryfallImagePath("normal/front/8/e/8ee443cc.jpg")).toBe(false);
  });
});
