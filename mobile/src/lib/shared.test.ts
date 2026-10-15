import assert from "node:assert/strict";
import { test } from "node:test";
import { splitImportText } from "./shared.ts";

const csv = (n: number, sep = false) =>
  [
    ...(sep ? ["sep=,"] : []),
    "Name,Quantity",
    ...Array.from({ length: n }, (_, i) => `Card ${i},1`),
  ].join("\n");

test("un CSV corto o una lista van de una vez", () => {
  assert.deepEqual(splitImportText(csv(10), true), [csv(10)]);
  const list = Array.from({ length: 500 }, (_, i) => `1 Card ${i}`).join("\n");
  assert.deepEqual(splitImportText(list, false), [list]);
});

test("un CSV largo se parte repitiendo la cabecera y sin perder filas", () => {
  const chunks = splitImportText(csv(1000, true), true);
  assert.ok(chunks.length > 1 && chunks.length <= 12);
  const rows: string[] = [];
  for (const c of chunks) {
    const lines = c.split("\n");
    assert.equal(lines[0], "sep=,");
    assert.equal(lines[1], "Name,Quantity");
    rows.push(...lines.slice(2));
  }
  assert.equal(rows.length, 1000);
  assert.equal(rows[999], "Card 999,1");
});

test("como mucho 12 tandas aunque sea enorme", () => {
  assert.equal(splitImportText(csv(20_000), true).length, 12);
});
