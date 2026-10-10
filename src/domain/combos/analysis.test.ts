import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { estimateBracket } from "../deck/bracket";
import { keyCards, oneAwayCombos } from "./analysis";
import type { Combo } from "./types";

const combo = (id: string, cards: string[], extra: Partial<Combo> = {}): Combo => ({
  id,
  cards: cards.map((c) => ({ oracleId: c, name: c.toUpperCase(), mustBeCommander: false })),
  produces: ["Win the game"],
  requires: [],
  bracketTag: "C",
  manaValueNeeded: 0,
  popularity: 10,
  ...extra,
});

describe("oneAwayCombos", () => {
  const ctx = {
    deck: new Set(["a", "b", "c"]),
    owned: new Map([
      ["libre", 1],
      ["ocupada", 1],
    ]),
    usage: new Map([["ocupada", { quantity: 1, decks: ["Otro"] }]]),
    prices: new Map([["comprar", 12.5]]),
  };

  it("dice qué carta falta y si la tengo, y ordena por eso y por popularidad", () => {
    const r = oneAwayCombos(
      [
        combo("1", ["a", "comprar"], { popularity: 999 }),
        combo("2", ["b", "ocupada"]),
        combo("3", ["c", "libre"], { popularity: 1 }),
        combo("4", ["a", "x", "y"]), // le faltan dos: no es "a una carta"
        combo("5", ["a", "b"]), // ya está completo
      ],
      ctx,
    );
    expect(r.map((x) => [x.combo.id, x.missing.name, x.status, x.price])).toEqual([
      ["3", "LIBRE", "owned", null],
      ["2", "OCUPADA", "in_other_decks", null],
      ["1", "COMPRAR", "buy", 12.5],
    ]);
  });
});

describe("estimateBracket con combos", () => {
  const cards = [{ card: makeCard({ name: "Algo" }), roles: [] }];

  it("un combo ruthless sube a 4; spicy o powerful a 3; el resto no cuenta", () => {
    expect(estimateBracket(cards, [combo("r", ["a", "b"], { bracketTag: "R" })])).toMatchObject({
      bracket: 4,
      combos: ["A + B"],
      combosChecked: true,
    });
    const spicy = estimateBracket(cards, [combo("s", ["c", "d"], { bracketTag: "S" })]);
    expect(spicy.bracket).toBe(3);
    expect(spicy.reasons).toContain("Combo: C + D");
    expect(estimateBracket(cards, [combo("e", ["a", "b"], { bracketTag: "E" })]).bracket).toBe(2);
  });

  it("sin combos comprobados lo dice", () => {
    expect(estimateBracket(cards).combosChecked).toBe(false);
    expect(estimateBracket(cards, []).combosChecked).toBe(true);
  });
});

describe("keyCards", () => {
  it("las cartas que completan más de un combo, de más a menos", () => {
    const ctx = { deck: new Set(["a", "b", "c"]), owned: new Map(), prices: new Map() };
    const r = keyCards(
      oneAwayCombos(
        [
          combo("1", ["a", "x"]),
          combo("2", ["b", "x"]),
          combo("3", ["c", "x"]),
          combo("4", ["a", "y"]),
          combo("5", ["b", "y"]),
          combo("6", ["a", "z"]),
        ],
        ctx,
      ),
      5,
    );
    expect(r.map((k) => [k.card.name, k.combos])).toEqual([
      ["X", 3],
      ["Y", 2],
    ]);
  });
});
