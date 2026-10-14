import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import type { Card } from "../cards/types";
import type { ResolvedDeck } from "../deck/resolve";
import type { ResolvedRecommendation } from "../recommendations/types";
import type { Role, RoleClassifier } from "../roles/types";
import { cheaperAlternatives } from "./alternatives";
import { DEFAULT_ENGINE_CONFIG } from "./config";

const classifier = (roles: Record<string, Role[]>): RoleClassifier => ({
  classify: (card) => {
    const r = roles[card.name] ?? ["synergy"];
    return { roles: r, primary: r[0] ?? "synergy" };
  },
});
const blue = (name: string, extra: Partial<Card> = {}) =>
  makeCard({ name, colorIdentity: ["U"], ...extra });
const rec = (card: Card, synergy: number, inclusion: number): ResolvedRecommendation => ({
  name: card.name,
  card,
  synergy,
  inclusion,
  numDecks: null,
  potentialDecks: null,
  categories: [],
});

const teferi = blue("Teferi", { typeLine: "Legendary Planeswalker" });
const rhystic = blue("Rhystic Study");
const mystic = blue("Mystic Remora");
const phyrexian = blue("Phyrexian Arena", { colorIdentity: ["B"] });
const pondering = blue("Ponder Deeply");
const brainstone = blue("Brainstone");
const solRing = blue("Sol Ring", { colorIdentity: [] });

const deck: ResolvedDeck = {
  commanders: [teferi],
  commanderSource: "marked",
  commanderCandidates: [],
  cards: [
    { card: rhystic, quantity: 1, lines: [] },
    { card: solRing, quantity: 1, lines: [] },
  ],
  unresolved: [],
};

const roles = classifier({
  "Rhystic Study": ["draw"],
  "Mystic Remora": ["draw"],
  "Phyrexian Arena": ["draw"],
  "Ponder Deeply": ["draw"],
  Brainstone: ["draw"],
  "Sol Ring": ["ramp"],
});

const run = (missing: { card: Card; price: number }[], owned = new Map<string, number>()) =>
  cheaperAlternatives({
    deck,
    missing,
    recommendations: [
      rec(mystic, 0.3, 0.5),
      rec(phyrexian, 0.4, 0.6),
      rec(pondering, 0.1, 0.2),
      rec(brainstone, 0.05, 0.1),
      rec(rhystic, 0.2, 0.7),
    ],
    owned,
    prices: new Map([
      [mystic.oracleId, 6],
      [pondering.oracleId, 0.5],
      [brainstone.oracleId, 0.2],
      [phyrexian.oracleId, 1],
    ]),
    classifier: roles,
    config: DEFAULT_ENGINE_CONFIG,
  });

describe("cheaperAlternatives", () => {
  it("propone cartas del mismo papel, de la identidad, fuera del mazo y mucho más baratas", () => {
    const [r] = run([{ card: rhystic, price: 30 }]);
    // Mystic Remora (6 €) cumple ≤ 50 %; Phyrexian Arena es negra; Rhystic ya está.
    expect(r?.alternatives.map((a) => a.card.name)).toEqual([
      "Mystic Remora",
      "Ponder Deeply",
      "Brainstone",
    ]);
  });

  it("primero las que tengo libres, aunque no sean baratas", () => {
    const [r] = run([{ card: rhystic, price: 10 }], new Map([[brainstone.oracleId, 1]]));
    expect(r?.alternatives.map((a) => [a.card.name, a.owned])).toEqual([
      ["Brainstone", true],
      ["Ponder Deeply", false],
    ]);
  });

  it("no busca nada para cartas baratas ni si no hay alternativas", () => {
    expect(run([{ card: rhystic, price: 2 }])).toEqual([]);
    expect(run([{ card: solRing, price: 5 }])).toEqual([]);
  });
});
