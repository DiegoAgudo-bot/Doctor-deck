import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCollectionLook, withCollectionLook } from "./collection-look.ts";

const SORTS = ["precio", "nombre", "recientes", "copias", "coste"];

test("lee el orden y la vista de la web", () => {
  assert.deepEqual(parseCollectionLook({ sort: "nombre", dir: null, view: "cuadricula" }, SORTS), {
    sort: "nombre",
    desc: false,
    grid: true,
  });
  assert.deepEqual(parseCollectionLook({ sort: "precio", dir: "asc", view: "tabla" }, SORTS), {
    sort: "precio",
    desc: false,
    grid: false,
  });
  assert.deepEqual(parseCollectionLook({ sort: "valor", colors: ["W"] }, SORTS), {});
  assert.deepEqual(parseCollectionLook(undefined, SORTS), {});
});

test("guarda lo de la app sin tocar los filtros de la web", () => {
  const pref = withCollectionLook(
    { colors: ["U"], sort: "nombre" },
    { sort: "precio", desc: true, grid: false },
  );
  assert.deepEqual(pref, { colors: ["U"], sort: "precio", dir: null, view: "tabla" });
  assert.equal(
    withCollectionLook(undefined, { sort: "nombre", desc: true, grid: true }).dir,
    "desc",
  );
});
