import assert from "node:assert/strict";
import { test } from "node:test";
import { itemFromPending } from "./share-pending.ts";

test("un fichero compartido (CSV o TXT)", () => {
  assert.deepEqual(
    itemFromPending(
      JSON.stringify({
        id: "1",
        path: "/data/x/files/shared-inbox/file-1-a.csv",
        fileName: "a.csv",
      }),
    ),
    {
      kind: "content",
      id: "1",
      text: null,
      files: [{ path: "/data/x/files/shared-inbox/file-1-a.csv", fileName: "a.csv" }],
    },
  );
});

test("una lista como texto", () => {
  assert.deepEqual(itemFromPending(JSON.stringify({ id: "2", text: "1 Sol Ring" })), {
    kind: "content",
    id: "2",
    text: "1 Sol Ring",
    files: null,
  });
});

test("errores y lo que llega roto", () => {
  assert.deepEqual(itemFromPending(JSON.stringify({ id: "3", error: "no se puede abrir" })), {
    kind: "error",
    message: "no se puede abrir",
  });
  assert.equal(itemFromPending("{roto").kind, "error");
  assert.equal(itemFromPending(JSON.stringify({ id: "4" })).kind, "error");
});
