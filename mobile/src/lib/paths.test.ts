import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, isOlder } from "./format.ts";
import { appRoute, inviteCodeFrom } from "./paths.ts";

const id = "0b5c1f2e-3d4a-4b6c-8d9e-0f1a2b3c4d5e";

test("appRoute: todo lo que tiene página va a una pantalla nativa", () => {
  assert.equal(appRoute(`/decks/${id}`), `/deck/${id}`);
  assert.equal(appRoute(`/decks/${id}?tab=missing`), `/deck/${id}?tab=missing`);
  assert.equal(appRoute(`/decks/${id}#comments`), `/deck-comments/${id}`);
  assert.equal(appRoute(`/cards/${id}`), `/card/${id}`);
  assert.equal(appRoute("/trades?tab=proposals"), "/trades?tab=proposals");
  assert.equal(appRoute("/trades?tab=raro"), "/trades");
  assert.equal(appRoute(`/trades/proposals/${id}`), `/trades/proposals/${id}`);
  assert.equal(appRoute("/trades/with/ana"), "/trades/with/ana");
  assert.equal(appRoute(`/groups/${id}`), `/groups/${id}`);
  assert.equal(appRoute("/groups/join/AbC123_x"), "/groups/join/AbC123_x");
  assert.equal(appRoute(`/games/${id}`), `/games/${id}`);
  assert.equal(appRoute("/u/ana"), "/u/ana");
  assert.equal(appRoute("/loans"), "/loans");
  assert.equal(appRoute("/play"), "/play");
  assert.equal(appRoute("/settings/"), "/settings");
});

test("appRoute: lo que no tiene pantalla, null (se abre en el navegador)", () => {
  assert.equal(appRoute("/privacy"), null);
  assert.equal(appRoute("/admin/errors"), null);
});

test("inviteCodeFrom: del enlace o del código suelto", () => {
  assert.equal(inviteCodeFrom(" https://doctordeck.app/groups/join/AbC123_x "), "AbC123_x");
  assert.equal(inviteCodeFrom("AbC123_x"), "AbC123_x");
  assert.equal(inviteCodeFrom("hola que tal"), null);
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
