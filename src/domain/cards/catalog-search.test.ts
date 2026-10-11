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
      sort: "name",
    });
    expect(catalogQueryParams(q).toString()).toBe(
      "q=dragon&colors=RG&mode=exact&type=creature&commander=1&cmc=5&sort=name",
    );
    expect(parseCatalogQuery(catalogQueryParams(q))).toEqual(q);
  });

  it("ignora lo que no entiende y sabe cuándo está vacía", () => {
    const q = parseCatalogQuery(new URLSearchParams("type=goblin&cmc=12&sort=price&mode=x"));
    expect(q).toEqual(EMPTY_CATALOG_QUERY);
    expect(isEmptyQuery(q)).toBe(true);
    expect(parseCatalogQuery(new URLSearchParams("colors=C")).colorless).toBe(true);
    expect(catalogQueryParams(EMPTY_CATALOG_QUERY).toString()).toBe("");
  });
});
