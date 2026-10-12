import { describe, expect, it } from "vitest";
import {
  catalogQueryParams,
  EMPTY_CATALOG_QUERY,
  isEmptyQuery,
  parseCatalogQuery,
} from "./catalog-search";

describe("consulta del buscador de cartas", () => {
  it("lee y escribe los parámetros de la URL", () => {
    const q = parseCatalogQuery(
      new URLSearchParams(
        "q=  dragon &colors=rg&mode=exact&type=creature&commander=1&cmc=5&sort=name",
      ),
    );
    expect(q).toEqual({
      text: "dragon",
      colors: ["R", "G"],
      colorMode: "exact",
      colorless: false,
      type: "creature",
      commander: true,
      gameChanger: false,
      cmc: 5,
      minPrice: null,
      maxPrice: null,
      sort: "name",
      dir: null,
    });
    expect(catalogQueryParams(q).toString()).toBe(
      "q=dragon&colors=RG&mode=exact&type=creature&commander=1&cmc=5&sort=name",
    );
    expect(parseCatalogQuery(catalogQueryParams(q))).toEqual(q);
  });

  it("ignora lo que no entiende y sabe cuándo está vacía", () => {
    const q = parseCatalogQuery(new URLSearchParams("type=goblin&cmc=12&sort=rarity&mode=x"));
    expect(q).toEqual(EMPTY_CATALOG_QUERY);
    expect(isEmptyQuery(q)).toBe(true);
    expect(parseCatalogQuery(new URLSearchParams("colors=C")).colorless).toBe(true);
    expect(catalogQueryParams(EMPTY_CATALOG_QUERY).toString()).toBe("");
  });
});

describe("precio y dirección en la URL", () => {
  it("lee y escribe min, max y dir (sin la dirección natural)", () => {
    const q = parseCatalogQuery(new URLSearchParams("sort=price&dir=asc&min=0,5&max=20"));
    expect(q).toMatchObject({ sort: "price", dir: "asc", minPrice: 0.5, maxPrice: 20 });
    expect(catalogQueryParams(q).toString()).toBe("min=0.5&max=20&sort=price&dir=asc");
    // "desc" es la natural del precio: no se guarda.
    expect(parseCatalogQuery(new URLSearchParams("sort=price&dir=desc")).dir).toBeNull();
    expect(parseCatalogQuery(new URLSearchParams("min=-3&max=abc"))).toMatchObject({
      minPrice: null,
      maxPrice: null,
    });
    expect(parseCatalogQuery(new URLSearchParams("sort=nope")).sort).toBe("popular");
  });
});
