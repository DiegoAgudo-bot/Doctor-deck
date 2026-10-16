import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeFilters,
  catalogParams,
  collectionQuery,
  EMPTY_FILTERS,
  numberOf,
  sinceDays,
} from "./collection-filters.ts";

test("sin filtros no se manda nada", () => {
  assert.deepEqual(collectionQuery(EMPTY_FILTERS), {});
  assert.equal(catalogParams(EMPTY_FILTERS, "").toString(), "");
  assert.deepEqual(activeFilters(EMPTY_FILTERS), []);
});

test("colección: rangos escritos a mano, listas y fecha", () => {
  const now = Date.parse("2026-10-16T15:00:00Z");
  const q = collectionQuery(
    {
      ...EMPTY_FILTERS,
      colors: ["G"],
      colorBy: "color",
      types: ["Creature", "Artifact"],
      cmc: { min: "2", max: "" },
      price: { min: "0,5", max: "abc" },
      rarities: ["mythic"],
      sets: ["CMM"],
      languages: ["es"],
      finish: "foil",
      addedWithin: 7,
      quantityMin: 2,
    },
    now,
  );
  assert.deepEqual(q, {
    colors: ["G"],
    colorMode: "alguno",
    colorBy: "color",
    types: ["Creature", "Artifact"],
    cmcMin: 2,
    priceMin: 0.5,
    rarities: ["mythic"],
    sets: ["CMM"],
    language: "es",
    finish: "foil",
    quantityMin: 2,
    addedSince: "2026-10-09T00:00:00.000Z",
  });
  assert.equal(sinceDays(1, now), "2026-10-15T00:00:00.000Z");
  assert.equal(numberOf(" "), undefined);
});

test("buscador: los parámetros de /api/cards", () => {
  const p = catalogParams(
    {
      ...EMPTY_FILTERS,
      colors: ["U", "R"],
      colorMode: "dentro",
      types: ["Instant"],
      supertypes: ["Legendary"],
      text: "draw",
      power: { min: "3", max: "" },
      rarities: ["rare", "mythic"],
      sets: ["mh3"],
      commander: true,
    },
    "bolt",
  );
  assert.equal(
    p.toString(),
    "q=bolt&colors=UR&mode=within&type=instant&super=legendary&o=draw&powmin=3" +
      "&rarity=rare%2Cmythic&set=mh3&commander=1",
  );
  assert.equal(catalogParams({ ...EMPTY_FILTERS, colors: ["C"] }, "").toString(), "colors=C");
});

test("fichas de los filtros puestos, con cómo quitarlos", () => {
  const chips = activeFilters({ ...EMPTY_FILTERS, cmc: { min: "", max: "3" }, finish: "foil" });
  assert.deepEqual(
    chips.map((c) => c.label),
    ["Maná …–3", "★ Foil"],
  );
  assert.deepEqual(chips[1]?.clear, { finish: "" });
});
