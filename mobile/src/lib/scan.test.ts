import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addScanned,
  orderLines,
  ScanTracker,
  scannedTotals,
  upgradeLatest,
  type Recognized,
  type ScannedCopy,
} from "./scan.ts";

const line = (lineText: string, y: number, x = 0, height = 10) => ({
  lineText,
  lineFrame: { x, y, height },
});

test("orderLines: de arriba abajo y, en la misma fila, de izquierda a derecha", () => {
  const lines = orderLines([
    { lines: [line("0263 U", 900, 10), line("Sol Ring", 20)] },
    { lines: [line("1/1", 880, 600), line("C21 • EN", 920, 10), line("{1}", 22, 500)] },
  ]);
  assert.deepEqual(lines, ["Sol Ring", "{1}", "1/1", "0263 U", "C21 • EN"]);
});

const ring: Recognized = { oracleId: "ring", scryfallId: null, confidence: 0.85 };
const ringExact: Recognized = { oracleId: "ring", scryfallId: "p1", confidence: 0.99 };
const bolt: Recognized = { oracleId: "bolt", scryfallId: null, confidence: 0.9 };

test("ScanTracker: pide dos lecturas iguales salvo que sea casi segura", () => {
  const t = new ScanTracker();
  assert.equal(t.observe(ring, 0), null);
  assert.equal(t.observe(ring, 100)?.kind, "accept");
  const t2 = new ScanTracker();
  assert.equal(t2.observe(ringExact, 0)?.kind, "accept");
});

test("ScanTracker: no cuenta dos veces la carta que sigue delante, pero corrige la impresión", () => {
  const t = new ScanTracker();
  t.observe(ring, 0);
  t.observe(ring, 100);
  assert.equal(t.observe(ring, 200), null);
  assert.deepEqual(t.observe(ringExact, 300), { kind: "upgrade", card: ringExact });
  assert.equal(t.observe(ringExact, 400), null);
});

test("ScanTracker: un parpadeo no la duplica; quitarla y volver a ponerla, sí", () => {
  const t = new ScanTracker();
  t.observe(ringExact, 0);
  t.observe(null, 100);
  assert.equal(t.observe(ringExact, 300), null); // 200 ms fuera: la misma copia
  t.observe(null, 400);
  assert.equal(t.observe(ringExact, 1200)?.kind, "accept"); // 800 ms fuera: otra copia
});

test("ScanTracker: otra carta distinta entra en cuanto se confirma", () => {
  const t = new ScanTracker();
  t.observe(ringExact, 0);
  assert.equal(t.observe(bolt, 100), null);
  assert.equal(t.observe(bolt, 200)?.kind, "accept");
  // Y volver a la primera cuenta como otra copia (casi segura: basta una lectura).
  assert.equal(t.observe(ringExact, 1000)?.kind, "accept");
});

const copy = (over: Partial<ScannedCopy> = {}): ScannedCopy => ({
  oracleId: "ring",
  scryfallId: null,
  name: "Sol Ring",
  printingLabel: null,
  imageUrl: null,
  price: 1.5,
  quantity: 1,
  foil: false,
  language: "en",
  condition: "near_mint",
  ...over,
});

test("addScanned: la misma copia suma; foil o idioma distinto va aparte", () => {
  let list = addScanned([], copy());
  list = addScanned(list, copy({ oracleId: "bolt", name: "Bolt" }));
  list = addScanned(list, copy());
  assert.deepEqual(
    list.map((c) => [c.name, c.quantity]),
    [
      ["Sol Ring", 2],
      ["Bolt", 1],
    ],
  );
  assert.equal(addScanned(list, copy({ foil: true })).length, 3);
  assert.equal(addScanned(list, copy({ language: "es" })).length, 3);
});

test("upgradeLatest: pone la impresión a la de arriba (solo una copia)", () => {
  const p = { scryfallId: "p1", printingLabel: "C21 #263", imageUrl: "/img/x", price: 2 };
  const one = upgradeLatest([copy()], "ring", p);
  assert.deepEqual(
    one.map((c) => [c.scryfallId, c.quantity]),
    [["p1", 1]],
  );
  const two = upgradeLatest([copy({ quantity: 2 })], "ring", p);
  assert.deepEqual(
    two.map((c) => [c.scryfallId, c.quantity]),
    [
      ["p1", 1],
      [null, 1],
    ],
  );
  assert.equal(upgradeLatest([copy()], "bolt", p)[0]!.scryfallId, null);
});

test("scannedTotals", () => {
  assert.deepEqual(scannedTotals([copy({ quantity: 2 }), copy({ price: null })]), {
    copies: 3,
    value: 3,
  });
});
