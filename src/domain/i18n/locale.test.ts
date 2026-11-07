import { describe, expect, it } from "vitest";
import { isUnlocalized, localePath, splitLocale } from "./locale";

describe("rutas por idioma", () => {
  it("el español va sin prefijo y el inglés con /en", () => {
    expect(localePath("es", "/cards")).toBe("/cards");
    expect(localePath("en", "/cards?q=sol")).toBe("/en/cards?q=sol");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/en/cards")).toBe("/en/cards");
  });

  it("la API, las imágenes, los ficheros y los enlaces externos no cambian", () => {
    expect(localePath("en", "/api/status")).toBe("/api/status");
    expect(localePath("en", "/img/normal/front/a/b/x.jpg")).toBe("/img/normal/front/a/b/x.jpg");
    expect(localePath("en", "/sitemap.xml")).toBe("/sitemap.xml");
    expect(localePath("en", "https://x.com/a")).toBe("https://x.com/a");
    expect(localePath("en", "//x.com")).toBe("//x.com");
    expect(isUnlocalized("/decks")).toBe(false);
  });

  it("separa el idioma de la ruta", () => {
    expect(splitLocale("/en/cards")).toEqual({ locale: "en", path: "/cards" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/es/decks/1")).toEqual({ locale: "es", path: "/decks/1" });
    expect(splitLocale("/entrar")).toEqual({ locale: "es", path: "/entrar" });
    expect(splitLocale("/cards")).toEqual({ locale: "es", path: "/cards" });
  });
});
