import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { peekShare, putShare, resetShareInbox, takeShare, type ShareItem } from "./share-inbox.ts";

const csv: ShareItem = {
  kind: "content",
  text: null,
  files: [{ path: "file:///cache/ManaBox Collection.csv", fileName: "ManaBox Collection.csv" }],
};

beforeEach(() => resetShareInbox());

test("guarda lo compartido hasta que se recoge", () => {
  assert.equal(putShare(csv), true);
  assert.deepEqual(peekShare(), csv);
  assert.deepEqual(takeShare(), csv);
  assert.equal(peekShare(), null);
  assert.equal(takeShare(), null);
});

test("con algo esperando, no entra otra cosa", () => {
  putShare(csv);
  assert.equal(putShare({ kind: "error", message: "x" }), false);
  assert.deepEqual(peekShare(), csv);
});

test("la misma entrega por la otra vía no se importa dos veces", () => {
  putShare(csv, 1000);
  takeShare(2000);
  assert.equal(putShare(csv, 3000), false);
  assert.equal(peekShare(), null);
  // Compartir el mismo fichero otra vez más tarde sí entra.
  assert.equal(putShare(csv, 60_000), true);
});

test("algo distinto entra aunque se acabe de recoger otra cosa", () => {
  putShare(csv, 1000);
  takeShare(2000);
  assert.equal(putShare({ kind: "content", text: "1 Sol Ring", files: null }, 3000), true);
});
