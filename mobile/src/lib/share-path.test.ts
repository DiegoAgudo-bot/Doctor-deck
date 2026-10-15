import assert from "node:assert/strict";
import { test } from "node:test";
import { shareFileUri } from "./share-path.ts";

test("codifica los nombres con espacios, # o %", () => {
  assert.equal(
    shareFileUri("file:///data/user/0/app.doctordeck/cache/ManaBox Collection.csv"),
    "file:///data/user/0/app.doctordeck/cache/ManaBox%20Collection.csv",
  );
  assert.equal(shareFileUri("file:///cache/a#b 100%.csv"), "file:///cache/a%23b%20100%25.csv");
  assert.equal(shareFileUri("/cache/lista.txt"), "file:///cache/lista.txt");
});

test("deja como están las ya codificadas y las content://", () => {
  assert.equal(shareFileUri("file:///cache/a%20b.csv"), "file:///cache/a%20b.csv");
  assert.equal(
    shareFileUri("content://app.provider/files/x.csv"),
    "content://app.provider/files/x.csv",
  );
});
