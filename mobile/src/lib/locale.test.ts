import assert from "node:assert/strict";
import { test } from "node:test";
import { deviceLocale } from "./lang.ts";

test("español en cualquier variante; el resto, inglés", () => {
  assert.equal(deviceLocale("es-ES"), "es");
  assert.equal(deviceLocale("es-419"), "es");
  assert.equal(deviceLocale("en-US"), "en");
  assert.equal(deviceLocale("fr-FR"), "en");
  assert.equal(deviceLocale("de"), "en");
});
