import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { InMemoryCardIndex } from "../cards/card-index";
import { parseDecklist } from "./decklist";
import { chooseCommanders, resolveDecklist, validateDeck } from "./resolve";

const atraxa = makeCard({
  name: "Atraxa, Praetors' Voice",
  typeLine: "Legendary Creature — Phyrexian Angel Horror",
  colorIdentity: ["W", "U", "B", "G"],
});
const thrasios = makeCard({
  name: "Thrasios, Triton Hero",
  typeLine: "Legendary Creature — Merfolk Wizard",
  keywords: ["Partner"],
  colorIdentity: ["G", "U"],
});
const tymna = makeCard({
  name: "Tymna the Weaver",
  typeLine: "Legendary Creature — Human Cleric",
  keywords: ["Partner"],
  colorIdentity: ["W", "B"],
});
const thalia = makeCard({
  name: "Thalia, Guardian of Thraben",
  typeLine: "Legendary Creature — Human Soldier",
  colorIdentity: ["W"],
});
const solRing = makeCard({ name: "Sol Ring" });
const bolt = makeCard({ name: "Lightning Bolt", typeLine: "Instant", colorIdentity: ["R"] });
const island = makeCard({
  name: "Island",
  typeLine: "Basic Land — Island",
  isBasicLand: true,
  colorIdentity: [],
});
const relentless = makeCard({
  name: "Relentless Rats",
  typeLine: "Creature — Rat",
  oracleText: "A deck can have any number of cards named Relentless Rats.",
  colorIdentity: ["B"],
});
const banned = makeCard({ name: "Mana Crypt", legalCommander: false });

const index = new InMemoryCardIndex(
  [atraxa, thrasios, tymna, thalia, solRing, bolt, island, relentless, banned],
  [
    {
      scryfallId: "p1",
      oracleId: solRing.oracleId,
      setCode: "c21",
      collectorNumber: "263",
      lang: "en",
      imageUrl: null,
    },
  ],
);

const resolve = (text: string) => resolveDecklist(parseDecklist(text), index);

describe("resolveDecklist", () => {
  it("usa el comandante marcado y lo saca de las 99", () => {
    const deck = resolve(
      "Commander\n1 Atraxa, Praetors' Voice\nDeck\n1 Sol Ring\n1 Thalia, Guardian of Thraben",
    );
    expect(deck.commanderSource).toBe("marked");
    expect(deck.commanders).toEqual([atraxa]);
    expect(deck.cards.map((c) => c.card.name)).toEqual(["Sol Ring", "Thalia, Guardian of Thraben"]);
  });

  it("detecta el comandante si solo hay un candidato", () => {
    const deck = resolve("1 Sol Ring\n1 Atraxa, Praetors' Voice\n10 Island");
    expect(deck.commanderSource).toBe("detected");
    expect(deck.commanders).toEqual([atraxa]);
  });

  it("detecta una pareja de partners", () => {
    const deck = resolve("1 Thrasios, Triton Hero\n1 Tymna the Weaver\n1 Sol Ring");
    expect(deck.commanders).toEqual([thrasios, tymna]);
  });

  it("pide elegir si hay varios candidatos incompatibles", () => {
    const deck = resolve("1 Atraxa, Praetors' Voice\n1 Thalia, Guardian of Thraben\n1 Sol Ring");
    expect(deck.commanderSource).toBe("none");
    expect(deck.commanderCandidates).toEqual([atraxa, thalia]);
    expect(deck.cards).toHaveLength(3);

    const chosen = chooseCommanders(deck, [atraxa.oracleId]);
    expect(chosen.commanderSource).toBe("chosen");
    expect(chosen.commanders).toEqual([atraxa]);
    expect(chosen.cards.map((c) => c.card.name)).toEqual([
      "Thalia, Guardian of Thraben",
      "Sol Ring",
    ]);
  });

  it("rechaza parejas inválidas de comandantes", () => {
    const deck = resolve("1 Atraxa, Praetors' Voice\n1 Thalia, Guardian of Thraben");
    expect(() => chooseCommanders(deck, [atraxa.oracleId, thalia.oracleId])).toThrow(
      /no es válida/,
    );
    expect(() => chooseCommanders(deck, ["nope"])).toThrow();
  });

  it("agrupa líneas repetidas de la misma carta y resuelve por set+número", () => {
    const deck = resolve("1 Sol Ring (C21) 263\n1 Sol Ring\n5 Island\n3 Island");
    expect(deck.cards.map((c) => [c.card.name, c.quantity, c.lines])).toEqual([
      ["Sol Ring", 2, [1, 2]],
      ["Island", 8, [3, 4]],
    ]);
  });

  it("devuelve las entradas que no encuentra", () => {
    const deck = resolve("1 Sol Ring\n1 Carta Inventada");
    expect(deck.unresolved.map((e) => e.name)).toEqual(["Carta Inventada"]);
  });
});

describe("validateDeck", () => {
  it("detecta tamaño, duplicados, identidad de color y cartas prohibidas", () => {
    const deck = resolve(
      "Commander\n1 Atraxa, Praetors' Voice\nDeck\n2 Sol Ring\n1 Lightning Bolt\n20 Island\n30 Relentless Rats\n1 Mana Crypt",
    );
    const kinds = validateDeck(deck).map((i) =>
      i.kind === "size" ? `size:${i.count}` : `${i.kind}:${"card" in i ? i.card.name : ""}`,
    );
    expect(kinds).toEqual([
      "size:55",
      "duplicate:Sol Ring",
      "colorIdentity:Lightning Bolt",
      "notLegal:Mana Crypt",
    ]);
  });

  it("avisa si no hay comandante", () => {
    expect(validateDeck(resolve("1 Sol Ring")).map((i) => i.kind)).toContain("noCommander");
  });
});
