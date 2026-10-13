import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, isOlder } from "./format.ts";
import { appRoute } from "./paths.ts";

const id = "0b5c1f2e-3d4a-4b6c-8d9e-0f1a2b3c4d5e";

test("appRoute: mazos y cartas en nativo, el resto en la web", () => {
  assert.equal(appRoute(`/decks/${id}`), `/deck/${id}`);
  assert.equal(appRoute(`/decks/${id}?tab=missing`), `/deck/${id}?tab=missing`);
  assert.equal(appRoute(`/cards/${id}`), `/card/${id}`);
  assert.equal(appRoute("/trades?tab=proposals"), "/web?path=%2Ftrades%3Ftab%3Dproposals");
  assert.equal(appRoute(`/decks/${id}#comments`), `/deck/${id}`);
});

test("isOlder compara versiones", () => {
  assert.equal(isOlder("1.0.0", "1.0.1"), true);
  assert.equal(isOlder("1.2.0", "1.10.0"), true);
  assert.equal(isOlder("2.0.0", "1.9.9"), false);
  assert.equal(isOlder("1.0.0", "1.0.0"), false);
});

test("ago", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  assert.equal(ago("2026-10-13T11:59:30Z", now), "ahora");
  assert.equal(ago("2026-10-13T09:00:00Z", now), "hace 3 h");
});
