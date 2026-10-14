import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import {
  addCardProblem,
  cardChangesProblem,
  decklistWithCard,
  decklistWithChanges,
} from "./add-card";
import { parseDecklist } from "./decklist";
import type { ResolvedDeck } from "./resolve";

const teferi = makeCard({
  name: "Teferi, Temporal Archmage",
  typeLine: "Legendary Planeswalker — Teferi",
  colorIdentity: ["U"],
});
const solRing = makeCard({ name: "Sol Ring" });
const island = makeCard({ name: "Island", typeLine: "Basic Land — Island", isBasicLand: true });
const counterspell = makeCard({ name: "Counterspell", colorIdentity: ["U"] });
const lightningBolt = makeCard({ name: "Lightning Bolt", colorIdentity: ["R"] });

const deck: ResolvedDeck = {
  commanders: [teferi],
  commanderSource: "marked",
  commanderCandidates: [],
  cards: [
    { card: solRing, quantity: 1, lines: [3], tags: ["Ramp"] },
    { card: island, quantity: 30, lines: [4] },
  ],
  unresolved: [
    {
      line: 5,
      quantity: 1,
      name: "Carta Inventada",
      setCode: null,
      collectorNumber: null,
      foil: false,
      commander: false,
    },
  ],
  printings: new Map([
    [
      solRing.oracleId,
      {
        scryfallId: "s",
        oracleId: solRing.oracleId,
        setCode: "c21",
        collectorNumber: "263",
        lang: "en",
        imageUrl: null,
      },
    ],
  ]),
};

describe("addCardProblem", () => {
  it("deja añadir una carta nueva de los colores del comandante", () => {
    expect(addCardProblem(deck, counterspell)).toBeNull();
  });

  it("no deja añadir el comandante, otra copia ni cartas de otro color", () => {
    expect(addCardProblem(deck, teferi)).toBe("is_commander");
    expect(addCardProblem(deck, solRing)).toBe("already_in_deck");
    expect(addCardProblem(deck, lightningBolt)).toBe("off_color");
  });

  it("las tierras básicas se pueden repetir", () => {
    expect(addCardProblem(deck, island)).toBeNull();
  });
});

describe("decklistWithCard", () => {
  it("añade la carta, conserva la impresión y las líneas que no se encontraron", () => {
    const text = decklistWithCard(deck, counterspell);
    expect(text).toBe(
      [
        "Commander",
        "1 Teferi, Temporal Archmage",
        "",
        "Deck",
        "1 Counterspell",
        "30 Island",
        "1 Sol Ring (C21) 263 #Ramp",
        "1 Carta Inventada",
        "",
      ].join("\n"),
    );
  });

  it("conserva el foil (*F*) y se vuelve a leer igual", () => {
    const foiled = { ...deck, foils: new Set([teferi.oracleId, solRing.oracleId]) };
    const text = decklistWithCard(foiled, counterspell);
    expect(text).toContain("1 Teferi, Temporal Archmage *F*");
    expect(text).toContain("1 Sol Ring (C21) 263 *F* #Ramp");
    const sol = parseDecklist(text).entries.find((e) => e.name === "Sol Ring");
    expect(sol).toMatchObject({
      setCode: "c21",
      collectorNumber: "263",
      foil: true,
      tags: ["Ramp"],
    });
  });

  it("una básica más suma a las que hay", () => {
    expect(decklistWithCard(deck, island)).toContain("31 Island");
  });
});

describe("cambios de varias cartas", () => {
  it("aplica un cambio «quita X → mete Y»", () => {
    const changes = [
      { card: solRing, delta: -1 },
      { card: counterspell, delta: 1 },
    ];
    expect(cardChangesProblem(deck, changes)).toBeNull();
    const text = decklistWithChanges(deck, changes);
    expect(text).toContain("1 Counterspell");
    expect(text).not.toContain("Sol Ring");
    expect(text).toContain("1 Carta Inventada");
  });

  it("quitar básicas resta copias", () => {
    expect(decklistWithChanges(deck, [{ card: island, delta: -2 }])).toContain("28 Island");
  });

  it("no deja quitar el comandante ni lo que no está, ni meter otra copia", () => {
    expect(cardChangesProblem(deck, [{ card: teferi, delta: -1 }])?.problem).toBe("is_commander");
    expect(cardChangesProblem(deck, [{ card: counterspell, delta: -1 }])?.problem).toBe(
      "not_in_deck",
    );
    expect(cardChangesProblem(deck, [{ card: solRing, delta: 1 }])?.problem).toBe(
      "already_in_deck",
    );
    expect(cardChangesProblem(deck, [{ card: lightningBolt, delta: 1 }])?.problem).toBe(
      "off_color",
    );
  });
});
