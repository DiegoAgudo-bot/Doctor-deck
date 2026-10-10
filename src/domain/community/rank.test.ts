import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { deckOwnership } from "../deck/ownership";
import { sortCommunity, summarizeOwnership, type CommunityCandidate } from "./rank";

const deck = (id: string, cards: [string, number][], extra: Partial<CommunityCandidate> = {}) => ({
  id,
  createdAt: new Date("2026-10-01"),
  likes: 0,
  cards: cards.map(([oracleId, quantity]) => ({ oracleId, quantity })),
  ...extra,
});

describe("summarizeOwnership", () => {
  const ctx = {
    owned: new Map([
      ["sol", 1],
      ["crypt", 1],
      ["rhystic", 2],
    ]),
    usage: new Map([["crypt", { quantity: 1, decks: ["Otro"] }]]),
    basics: new Set(["island"]),
    prices: new Map([["tithe", 25]]),
  };

  it("cuenta lo que tengo libre, lo de otros mazos y lo que falta con su precio", () => {
    const s = summarizeOwnership(
      deck("a", [
        ["sol", 1],
        ["crypt", 1],
        ["rhystic", 1],
        ["tithe", 2],
        ["mystery", 1],
        ["island", 30],
      ]),
      ctx,
    );
    expect(s).toEqual({
      cards: 6,
      have: 2,
      fromOtherDecks: 1,
      toBuy: 3,
      percent: 33,
      cost: 50,
      unpriced: 1,
    });
  });

  it("da los mismos totales que deckOwnership", () => {
    const cards = ["sol", "crypt", "rhystic", "tithe"].map((id) =>
      makeCard({ name: id, oracleId: id }),
    );
    const island = makeCard({ name: "Island", oracleId: "island", isBasicLand: true });
    const full = deckOwnership(
      [cards[0]!],
      [...cards.slice(1).map((card) => ({ card, quantity: 1 })), { card: island, quantity: 30 }],
      ctx.owned,
      ctx.usage,
    ).totals;
    const s = summarizeOwnership(
      deck("a", [
        ["sol", 1],
        ["crypt", 1],
        ["rhystic", 1],
        ["tithe", 1],
        ["island", 30],
      ]),
      ctx,
    );
    expect({
      cards: s.cards,
      have: s.have,
      fromOtherDecks: s.fromOtherDecks,
      toBuy: s.toBuy,
    }).toEqual(full);
  });
});

describe("sortCommunity", () => {
  const own = (percent: number, cost = 0) => ({
    cards: 10,
    have: 0,
    fromOtherDecks: 0,
    toBuy: 0,
    percent,
    cost,
    unpriced: 0,
  });
  const items = [
    {
      deck: deck("viejo", [], { createdAt: new Date("2026-01-01"), likes: 5 }),
      ownership: own(90, 40),
    },
    {
      deck: deck("nuevo", [], { createdAt: new Date("2026-10-01"), likes: 1 }),
      ownership: own(20),
    },
    {
      deck: deck("medio", [], { createdAt: new Date("2026-05-01"), likes: 5 }),
      ownership: own(90, 10),
    },
  ];
  const ids = (sort: Parameters<typeof sortCommunity>[1]) =>
    sortCommunity(items, sort).map((i) => i.deck.id);

  it("recientes, más gustados y los que más tengo", () => {
    expect(ids("recent")).toEqual(["nuevo", "medio", "viejo"]);
    expect(ids("likes")).toEqual(["medio", "viejo", "nuevo"]);
    expect(ids("owned")).toEqual(["medio", "viejo", "nuevo"]);
  });
});
