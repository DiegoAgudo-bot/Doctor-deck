import assert from "node:assert/strict";
import { test } from "node:test";
import { matchDecks } from "./global-search.ts";

const decks = [
  { name: "Jund - Aristócratas", commanderNames: ["Korvold, Fae-Cursed King"] },
  { name: "Elfos", commanderNames: ["Lathril, Blade of the Elves"] },
  { name: "Mono azul", commanderNames: ["Urza, Lord High Artificer"] },
];

test("busca en el nombre y el comandante, sin tildes", () => {
  assert.deepEqual(
    matchDecks(decks, "aristocratas").map((d) => d.name),
    ["Jund - Aristócratas"],
  );
  assert.deepEqual(
    matchDecks(decks, "urza azul").map((d) => d.name),
    ["Mono azul"],
  );
  assert.deepEqual(matchDecks(decks, "  "), []);
  assert.equal(matchDecks(decks, "a", 2).length, 2);
});
