import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { InMemoryCardIndex } from "../cards/card-index";
import type { Card } from "../cards/types";
import { parseDecklist } from "./decklist";
import { chooseCommanders, fittingCandidates, resolveDecklist, validateDeck } from "./resolve";

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

  it("pide elegir si hay varios candidatos incompatibles (solo los que encajan con los colores)", () => {
    const deck = resolve("1 Atraxa, Praetors' Voice\n1 Thalia, Guardian of Thraben\n1 Sol Ring");
    expect(deck.commanderSource).toBe("none");
    // Thalia (blanca) no puede ser la comandante: Atraxa no cabría en su identidad.
    expect(deck.commanderCandidates).toEqual([atraxa]);
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

describe("fittingCandidates", () => {
  const legend = (name: string, colorIdentity: string[], extra: Partial<Card> = {}) =>
    makeCard({
      name,
      typeLine: "Legendary Creature — Human",
      colorIdentity: colorIdentity as never,
      ...extra,
    });
  const spell = (name: string, colorIdentity: string[]) =>
    makeCard({ name, typeLine: "Instant", colorIdentity: colorIdentity as never });

  const winota = legend("Winota, Joiner of Forces", ["R", "W"]);
  const feather = legend("Feather, the Redeemed", ["R", "W"]);
  const thaliaW = legend("Thalia, Guardian of Thraben", ["W"]);
  const krenkoR = legend("Krenko, Mob Boss", ["R"]);
  const karn = legend("Karn, Silver Golem", []);
  const deckOf = (...cards: ReturnType<typeof makeCard>[]) => cards.map((card) => ({ card }));

  it("en un mazo blanco y rojo solo ofrece las legendarias blancas y rojas", () => {
    const deck = deckOf(
      winota,
      feather,
      thaliaW,
      krenkoR,
      karn,
      spell("Lightning Bolt", ["R"]),
      spell("Swords to Plowshares", ["W"]),
      spell("Boros Charm", ["R", "W"]),
    );
    expect(fittingCandidates([winota, feather, thaliaW, krenkoR, karn], deck)).toEqual([
      winota,
      feather,
    ]);
  });

  it("si se ha colado una carta de otro color, se queda con las que mejor encajan", () => {
    const deck = deckOf(
      winota,
      thaliaW,
      spell("Lightning Bolt", ["R"]),
      spell("Swords to Plowshares", ["W"]),
      spell("Cultivate", ["G"]),
    );
    expect(fittingCandidates([winota, thaliaW], deck)).toEqual([winota]);
  });

  it("tiene en cuenta las parejas: dos partners que juntos cubren los colores", () => {
    const tymnaWB = legend("Tymna the Weaver", ["W", "B"], { keywords: ["Partner"] });
    const kraumUR = legend("Kraum, Ludevic's Opus", ["U", "R"], { keywords: ["Partner"] });
    const deck = deckOf(
      tymnaWB,
      kraumUR,
      thaliaW,
      spell("Counterspell", ["U"]),
      spell("Lightning Bolt", ["R"]),
      spell("Doom Blade", ["B"]),
    );
    expect(fittingCandidates([tymnaWB, kraumUR, thaliaW], deck)).toEqual([tymnaWB, kraumUR]);
  });

  it("sin ninguna opción válida devuelve las candidatas tal cual", () => {
    const background = makeCard({
      name: "Raised by Giants",
      typeLine: "Legendary Enchantment — Background",
      colorIdentity: ["G"],
    });
    expect(fittingCandidates([background], deckOf(background))).toEqual([background]);
  });
});

describe("resolveDecklist: impresiones", () => {
  it("recuerda la impresión pedida (edición y número o Scryfall ID)", async () => {
    const { fixtureCards, fixturePrintings } =
      await import("../../../tests/helpers/scryfall-fixtures");
    const idx = new InMemoryCardIndex(fixtureCards(), fixturePrintings());
    const deck = resolveDecklist(
      parseDecklist(
        "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Sol Ring (LEA) 270\n1 Island",
      ),
      idx,
    );
    const sol = deck.cards.find((c) => c.card.name === "Sol Ring")!.card;
    expect(deck.printings?.get(sol.oracleId)).toMatchObject({
      setCode: "lea",
      collectorNumber: "270",
    });
    const island = deck.cards.find((c) => c.card.name === "Island")!.card;
    expect(deck.printings?.has(island.oracleId)).toBe(false);
  });
});
