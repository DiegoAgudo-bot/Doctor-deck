import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { HeuristicRoleClassifier } from "./heuristic-classifier";
import type { Role } from "./types";

const classifier = new HeuristicRoleClassifier();

/** [nombre, tipo, oracle text, roles esperados, rol principal] */
type Case = [string, string, string, Role[], Role];

const CASES: Case[] = [
  // --- ramp ---
  ["Sol Ring", "Artifact", "{T}: Add {C}{C}.", ["ramp"], "ramp"],
  [
    "Arcane Signet",
    "Artifact",
    "{T}: Add one mana of any color in your commander's color identity.",
    ["ramp"],
    "ramp",
  ],
  ["Llanowar Elves", "Creature — Elf Druid", "{T}: Add {G}.", ["ramp"], "ramp"],
  [
    "Cultivate",
    "Sorcery",
    "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    ["ramp"],
    "ramp",
  ],
  [
    "Farseek",
    "Sorcery",
    "Search your library for a Plains, Island, Swamp, or Mountain card and put it onto the battlefield tapped, then shuffle.",
    ["ramp"],
    "ramp",
  ],
  [
    "Exploration",
    "Enchantment",
    "You may play an additional land on each of your turns.",
    ["ramp"],
    "ramp",
  ],
  [
    "Smothering Tithe",
    "Enchantment",
    "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.",
    ["ramp"],
    "ramp",
  ],
  [
    "Mind Stone",
    "Artifact",
    "{T}: Add {C}.\n{1}, {T}, Sacrifice Mind Stone: Draw a card.",
    ["ramp", "draw"],
    "ramp",
  ],
  // --- robo ---
  ["Harmonize", "Sorcery", "Draw three cards.", ["draw"], "draw"],
  [
    "Rhystic Study",
    "Enchantment",
    "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
    ["draw"],
    "draw",
  ],
  [
    "Fact or Fiction",
    "Instant",
    "Reveal the top five cards of your library. An opponent separates those cards into two piles. Put one pile into your hand and the other into your graveyard.",
    ["draw"],
    "draw",
  ],
  [
    "Light Up the Stage",
    "Sorcery",
    "Spectacle {R}\nExile the top two cards of your library. Until the end of your next turn, you may play those cards.",
    ["draw"],
    "draw",
  ],
  [
    "Tireless Tracker",
    "Creature — Human Scout",
    'Whenever a land you control enters, investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this artifact: Draw a card.")\nWhenever you sacrifice a Clue, put a +1/+1 counter on Tireless Tracker.',
    ["draw"],
    "draw",
  ],
  // --- removal puntual ---
  [
    "Swords to Plowshares",
    "Instant",
    "Exile target creature. Its controller gains life equal to its power.",
    ["removal"],
    "removal",
  ],
  [
    "Beast Within",
    "Instant",
    "Destroy target permanent. Its controller creates a 3/3 green Beast creature token.",
    ["removal"],
    "removal",
  ],
  [
    "Lightning Bolt",
    "Instant",
    "Lightning Bolt deals 3 damage to any target.",
    ["removal"],
    "removal",
  ],
  [
    "Nature's Claim",
    "Instant",
    "Destroy target artifact or enchantment. Its controller gains 4 life.",
    ["removal"],
    "removal",
  ],
  [
    "Pongify",
    "Instant",
    "Destroy target creature. It can't be regenerated. Its controller creates a 3/3 green Ape creature token.",
    ["removal"],
    "removal",
  ],
  [
    "Snap",
    "Instant",
    "Return target creature to its owner's hand. Untap up to two lands.",
    ["removal"],
    "removal",
  ],
  ["Dismember", "Instant", "Target creature gets -5/-5 until end of turn.", ["removal"], "removal"],
  [
    "Marang River Regent",
    "Creature — Dragon",
    "Flying\nWhen this creature enters, return up to two other target nonland permanents to their owners' hands.",
    ["removal"],
    "removal",
  ],
  // --- wipes ---
  [
    "Wrath of God",
    "Sorcery",
    "Destroy all creatures. They can't be regenerated.",
    ["wipe"],
    "wipe",
  ],
  [
    "Blasphemous Act",
    "Sorcery",
    "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature.",
    ["wipe"],
    "wipe",
  ],
  [
    "Toxic Deluge",
    "Sorcery",
    "As an additional cost to cast this spell, pay X life.\nAll creatures get -X/-X until end of turn.",
    ["wipe"],
    "wipe",
  ],
  [
    "Cyclonic Rift",
    "Instant",
    'Return target nonland permanent you don\'t control to its owner\'s hand.\nOverload {6}{U} (You may cast this spell for its overload cost. If you do, change its text by replacing all instances of "target" with "each.")',
    ["removal"],
    "removal",
  ],
  [
    "Vanquish the Horde",
    "Sorcery",
    "This spell costs {1} less to cast for each creature on the battlefield.\nDestroy all creatures.",
    ["wipe"],
    "wipe",
  ],
  // --- counters ---
  ["Counterspell", "Instant", "Counter target spell.", ["counterspell"], "counterspell"],
  [
    "Arcane Denial",
    "Instant",
    "Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.\nYou draw a card at the beginning of the next turn's upkeep.",
    ["draw", "counterspell"],
    "counterspell",
  ],
  ["Negate", "Instant", "Counter target noncreature spell.", ["counterspell"], "counterspell"],
  // --- tutores ---
  [
    "Demonic Tutor",
    "Sorcery",
    "Search your library for a card, put that card into your hand, then shuffle.",
    ["tutor"],
    "tutor",
  ],
  [
    "Enlightened Tutor",
    "Instant",
    "Search your library for an artifact or enchantment card, reveal it, then shuffle and put that card on top.",
    ["tutor"],
    "tutor",
  ],
  // --- protección ---
  [
    "Heroic Intervention",
    "Instant",
    "Permanents you control gain hexproof and indestructible until end of turn.",
    ["protection"],
    "protection",
  ],
  [
    "Lightning Greaves",
    "Artifact — Equipment",
    "Equipped creature has haste and shroud.\nEquip {0}",
    ["protection"],
    "protection",
  ],
  [
    "Teferi's Protection",
    "Instant",
    "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out.\nExile Teferi's Protection.",
    ["protection"],
    "protection",
  ],
  // --- tierras ---
  [
    "Command Tower",
    "Land",
    "{T}: Add one mana of any color in your commander's color identity.",
    ["land"],
    "land",
  ],
  ["Island", "Basic Land — Island", "({T}: Add {U}.)", ["land"], "land"],
  // --- sinergia / resto ---
  [
    "Craterhoof Behemoth",
    "Creature — Beast",
    "Haste\nWhen Craterhoof Behemoth enters, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
    ["synergy"],
    "synergy",
  ],
  [
    "Carnage Tyrant",
    "Creature — Dinosaur",
    "This spell can't be countered.\nTrample, hexproof",
    ["synergy"],
    "synergy",
  ],
  [
    "Ephemerate",
    "Instant",
    "Exile target creature you control, then return it to the battlefield under its owner's control.\nRebound",
    ["synergy"],
    "synergy",
  ],
  [
    "Hardened Scales",
    "Enchantment",
    "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
    ["synergy"],
    "synergy",
  ],
];

describe("HeuristicRoleClassifier", () => {
  it.each(CASES)("%s", (name, typeLine, oracleText, roles, primary) => {
    const result = classifier.classify(makeCard({ name, typeLine, oracleText }));
    expect(result.roles).toEqual(roles);
    expect(result.primary).toBe(primary);
  });

  it("en MDFC hechizo // tierra cuenta la cara frontal", () => {
    const card = makeCard({
      name: "Sink into Stupor // Soporific Springs",
      typeLine: "Instant // Land",
      oracleText:
        "Return target spell or nonland permanent an opponent controls to its owner's hand.\n//\nAs Soporific Springs enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {U}.",
    });
    expect(classifier.classify(card).roles).toContain("removal");
    expect(classifier.classify(card).roles).not.toContain("land");
  });

  it("una carta sin texto es sinergia", () => {
    expect(
      classifier.classify(makeCard({ name: "Grizzly Bears", typeLine: "Creature — Bear" })),
    ).toEqual({
      roles: ["synergy"],
      primary: "synergy",
    });
  });
});
