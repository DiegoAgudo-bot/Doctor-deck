import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { buildOwnedDeck, type OwnedDeckCandidate } from "./owned-deck";

const izzet = makeCard({
  name: "Niv-Mizzet, Parun",
  typeLine: "Legendary Creature — Dragon Wizard",
  colorIdentity: ["U", "R"],
});
const rec = (card: ReturnType<typeof makeCard>, inclusion: number, synergy = 0) =>
  ({ card, inclusion, synergy }) satisfies OwnedDeckCandidate;

const opt = makeCard({ name: "Opt", colorIdentity: ["U"], typeLine: "Instant" });
const bolt = makeCard({ name: "Lightning Bolt", colorIdentity: ["R"], typeLine: "Instant" });
const solRing = makeCard({ name: "Sol Ring" });
const swords = makeCard({
  name: "Swords to Plowshares",
  colorIdentity: ["W"],
  typeLine: "Instant",
});
const banned = makeCard({ name: "Mana Crypt", legalCommander: false });
const shivan = makeCard({ name: "Shivan Reef", typeLine: "Land" });
const notMine = makeCard({ name: "Counterspell", colorIdentity: ["U"], typeLine: "Instant" });

const free = new Map([
  [opt.oracleId, 1],
  [bolt.oracleId, 2],
  [solRing.oracleId, 1],
  [swords.oracleId, 1],
  [banned.oracleId, 1],
  [shivan.oracleId, 1],
  [izzet.oracleId, 1],
]);

describe("buildOwnedDeck", () => {
  const deck = buildOwnedDeck({
    commanders: [izzet],
    recommendations: [
      rec(opt, 0.3),
      rec(bolt, 0.6, 0.1),
      rec(solRing, 0.9),
      rec(swords, 0.8), // fuera de los colores
      rec(banned, 0.95), // prohibida
      rec(notMine, 0.7), // no la tengo
      rec(shivan, 0.5),
      rec(izzet, 1), // es el comandante
    ],
    free,
  });

  it("solo mete las recomendadas que tengo libres, legales y de sus colores, una copia", () => {
    expect(deck.spells).toBe(3);
    expect(deck.nonbasicLands).toBe(1);
    expect(deck.input).toContain("1 Sol Ring");
    expect(deck.input).toContain("1 Lightning Bolt");
    expect(deck.input).toContain("1 Shivan Reef");
    for (const name of ["Swords to Plowshares", "Mana Crypt", "Counterspell"]) {
      expect(deck.input).not.toContain(name);
    }
    expect(deck.input.match(/Niv-Mizzet/g)).toHaveLength(1);
  });

  it("completa las 36 tierras con básicas repartidas entre sus colores", () => {
    expect(deck.basics).toBe(35);
    expect(deck.input).toContain("18 Island");
    expect(deck.input).toContain("17 Mountain");
  });

  it("dice cuántos hechizos faltan para llegar a 99", () => {
    expect(deck.missing).toBe(63 - 3);
  });

  it("con muchos hechizos, se queda con los más jugados", () => {
    const spells = Array.from({ length: 70 }, (_, i) =>
      makeCard({ name: `Spell ${String(i).padStart(2, "0")}`, colorIdentity: ["U"] }),
    );
    const full = buildOwnedDeck({
      commanders: [izzet],
      recommendations: spells.map((c, i) => rec(c, i / 100)),
      free: new Map(spells.map((c) => [c.oracleId, 1])),
    });
    expect(full.spells).toBe(63);
    expect(full.missing).toBe(0);
    expect(full.input).toContain("Spell 69");
    expect(full.input).not.toContain("Spell 06");
  });

  it("un comandante incoloro usa Wastes", () => {
    const karn = makeCard({ name: "Karn, Silver Golem", typeLine: "Legendary Artifact Creature" });
    expect(buildOwnedDeck({ commanders: [karn], recommendations: [], free }).input).toContain(
      "36 Wastes",
    );
  });
});
