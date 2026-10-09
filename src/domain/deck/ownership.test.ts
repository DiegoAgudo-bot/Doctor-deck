import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { deckOwnership } from "./ownership";

const korvold = makeCard({ name: "Korvold, Fae-Cursed King", typeLine: "Legendary Creature" });
const sol = makeCard({ name: "Sol Ring" });
const devil = makeCard({ name: "Mayhem Devil" });
const crypt = makeCard({ name: "Mana Crypt" });
const rats = makeCard({ name: "Relentless Rats" });
const swamp = makeCard({ name: "Swamp", isBasicLand: true, typeLine: "Basic Land — Swamp" });

describe("deckOwnership", () => {
  const { items, totals } = deckOwnership(
    [korvold],
    [
      { card: sol, quantity: 1 },
      { card: devil, quantity: 1 },
      { card: crypt, quantity: 1 },
      { card: rats, quantity: 5 },
      { card: swamp, quantity: 30 },
    ],
    new Map([
      [korvold.oracleId, 1],
      [sol.oracleId, 1],
      [devil.oracleId, 1],
      [rats.oracleId, 3],
    ]),
    new Map([[devil.oracleId, { quantity: 1, decks: ["Meren"] }]]),
  );
  const by = (name: string) => items.find((i) => i.card.name === name);

  it("clasifica cada carta: la tengo, está en otro mazo, me falta o es básica", () => {
    expect(by("Korvold, Fae-Cursed King")).toMatchObject({ status: "owned", isCommander: true });
    expect(by("Sol Ring")).toMatchObject({ status: "owned", toBuy: 0, fromOtherDecks: 0 });
    expect(by("Mayhem Devil")).toMatchObject({
      status: "in_other_decks",
      fromOtherDecks: 1,
      toBuy: 0,
      usedIn: ["Meren"],
    });
    expect(by("Mana Crypt")).toMatchObject({ status: "missing", toBuy: 1, owned: 0 });
    // Tengo 3 de 5: faltan 2.
    expect(by("Relentless Rats")).toMatchObject({ status: "missing", toBuy: 2, owned: 3 });
    expect(by("Swamp")).toMatchObject({ status: "basic", toBuy: 0 });
  });

  it("los totales no cuentan las básicas", () => {
    // 1 + 1 + 1 + 1 + 5 = 9 copias; libres: Korvold, Sol Ring y 3 Rats = 5.
    expect(totals).toEqual({ cards: 9, have: 5, fromOtherDecks: 1, toBuy: 3 });
  });

  it("sin mazos guardados (o sin descontarlos) todo lo que tengo está libre", () => {
    const r = deckOwnership([], [{ card: devil, quantity: 1 }], new Map([[devil.oracleId, 1]]));
    expect(r.items[0]?.status).toBe("owned");
  });
});
