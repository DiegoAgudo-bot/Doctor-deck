import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import type { Card } from "../cards/types";
import type { ResolvedDeck } from "../deck/resolve";
import type { ResolvedRecommendation } from "../recommendations/types";
import type { Role, RoleClassifier } from "../roles/types";
import { DEFAULT_ENGINE_CONFIG, mergeEngineConfig, type EngineConfig } from "./config";
import { suggestSwaps, type EngineInput } from "./engine";

// ---------- helpers ----------

/** Clasificador de prueba: roles definidos por nombre (el primero es el principal). */
function fakeClassifier(roles: Record<string, Role[]>): RoleClassifier {
  return {
    classify: (card) => {
      const r = roles[card.name] ?? ["synergy"];
      return { roles: r, primary: r[0] ?? "synergy" };
    },
  };
}

const commander = makeCard({
  name: "Teferi, Temporal Archmage",
  typeLine: "Legendary Planeswalker — Teferi",
  oracleText: "Teferi, Temporal Archmage can be your commander.",
  colorIdentity: ["U"],
});

const card = (name: string, extra: Partial<Card> = {}) =>
  makeCard({ name, colorIdentity: ["U"], ...extra });

function deckOf(cards: Card[], quantities: Record<string, number> = {}): ResolvedDeck {
  return {
    commanders: [commander],
    commanderSource: "marked",
    commanderCandidates: [],
    cards: cards.map((c) => ({ card: c, quantity: quantities[c.name] ?? 1, lines: [] })),
    unresolved: [],
  };
}

const rec = (
  c: Card,
  synergy: number | null,
  inclusion: number | null,
): ResolvedRecommendation => ({
  name: c.name,
  card: c,
  synergy,
  inclusion,
  numDecks: null,
  potentialDecks: null,
  categories: [],
});

const noMinimums = mergeEngineConfig({
  minimums: { land: 0, ramp: 0, draw: 0, removal: 0, wipe: 0 },
});

function run(
  partial: Partial<EngineInput> & Pick<EngineInput, "deck">,
  config: EngineConfig = noMinimums,
) {
  return suggestSwaps({
    recommendations: [],
    owned: new Map(),
    locked: new Set(),
    classifier: fakeClassifier({}),
    config,
    ...partial,
  });
}

const owns = (...cards: Card[]) => new Map(cards.map((c) => [c.oracleId, 1]));

// ---------- tests ----------

describe("suggestSwaps: caso básico y motivo", () => {
  it("propone quita X → mete Y con el motivo legible", () => {
    const manaVault = card("Mind Stone");
    const signet = card("Arcane Signet");
    const result = run({
      deck: deckOf([manaVault]),
      recommendations: [rec(manaVault, 0.01, 0.04), rec(signet, 0.12, 0.38)],
      owned: owns(signet),
      classifier: fakeClassifier({ "Mind Stone": ["ramp"], "Arcane Signet": ["ramp"] }),
    });
    expect(result.swaps).toHaveLength(1);
    const [swap] = result.swaps;
    expect(swap?.out.card.name).toBe("Mind Stone");
    expect(swap?.in.card.name).toBe("Arcane Signet");
    expect(swap?.sameRole).toBe(true);
    expect(swap?.reason).toBe(
      "Sustituye a Mind Stone (ramp, 4 % inclusión) por Arcane Signet (ramp, 38 % inclusión, +12 synergy). La tienes en tu colección.",
    );
    // score = (0.12 + 0.38) − (0.01 + 0.04) + 0.2·1
    expect(swap?.score).toBeCloseTo(0.65);
  });

  it("explica cartas que no están en EDHREC, cambios de rol y varias copias", () => {
    const pet = card("Pet Card");
    const draw = card("Harmonize");
    const result = run({
      deck: deckOf([pet]),
      recommendations: [rec(draw, -0.05, 0.3)],
      owned: new Map([[draw.oracleId, 3]]),
      classifier: fakeClassifier({ "Pet Card": ["synergy"], Harmonize: ["draw"] }),
    });
    expect(result.swaps[0]?.reason).toBe(
      "Sustituye a Pet Card (sinergia, no aparece en EDHREC para este comandante) por Harmonize (robo, 30 % inclusión, −5 synergy). La tienes en tu colección (3 copias). Cambia sinergia por robo.",
    );
  });
});

describe("suggestSwaps: candidatos a entrar", () => {
  const inDeck = card("In Deck");
  const notOwned = card("Not Owned");
  const owned = card("Owned");
  const banned = card("Banned", { legalCommander: false });
  const offColor = card("Off Color", { colorIdentity: ["R"] });
  const colorless = card("Colorless", { colorIdentity: [] });
  const basic = card("Island", { isBasicLand: true, typeLine: "Basic Land — Island" });
  const filler = card("Filler");

  const result = run({
    deck: deckOf([inDeck, filler]),
    recommendations: [inDeck, notOwned, owned, banned, offColor, colorless, basic].map((c) =>
      rec(c, 0.2, 0.5),
    ),
    owned: owns(inDeck, owned, banned, offColor, colorless, basic),
  });

  it("solo recomendadas ∩ colección, fuera del mazo, legales y en identidad de color", () => {
    expect(result.addCandidates.map((c) => c.card.name).sort()).toEqual(["Colorless", "Owned"]);
  });

  it("no propone las cartas que el usuario ha descartado", () => {
    const r = run({
      deck: deckOf([filler]),
      recommendations: [rec(owned, 0.2, 0.5), rec(colorless, 0.2, 0.5)],
      owned: owns(owned, colorless),
      excluded: new Set([owned.oracleId]),
    });
    expect(r.addCandidates.map((c) => c.card.name)).toEqual(["Colorless"]);
  });

  it("ordena por score y guarda las copias que tengo", () => {
    const r = run({
      deck: deckOf([filler]),
      recommendations: [rec(owned, 0.1, 0.1), rec(colorless, 0.3, 0.3)],
      owned: new Map([
        [owned.oracleId, 1],
        [colorless.oracleId, 2],
      ]),
    });
    expect(r.addCandidates.map((c) => [c.card.name, c.owned])).toEqual([
      ["Colorless", 2],
      ["Owned", 1],
    ]);
  });
});

describe("suggestSwaps: candidatos a salir", () => {
  const island = card("Island", { isBasicLand: true, typeLine: "Basic Land — Island" });
  const locked = card("Locked Pet");
  const unknown = card("Unknown");
  const weak = card("Weak");
  const strong = card("Strong");
  const negative = card("Negative");
  const better = card("Better");

  const result = run({
    deck: deckOf([island, locked, weak, strong, unknown, negative], { Island: 30 }),
    recommendations: [
      rec(weak, 0.0, 0.05),
      rec(strong, 0.3, 0.6),
      rec(negative, -0.2, 0.1),
      rec(better, 0.4, 0.7),
    ],
    owned: owns(better),
    locked: new Set([locked.oracleId]),
  });

  it("nunca corta comandante, básicas ni bloqueadas", () => {
    const names = result.cutCandidates.map((c) => c.card.name);
    expect(names).not.toContain("Island");
    expect(names).not.toContain("Locked Pet");
    expect(names).not.toContain(commander.name);
  });

  it("las que no aparecen en EDHREC van primero; luego de peor a mejor score", () => {
    expect(result.cutCandidates.map((c) => c.card.name)).toEqual([
      "Unknown",
      "Negative",
      "Weak",
      "Strong",
    ]);
  });

  it("el mejor cambio saca la peor carta", () => {
    // Unknown (score 0) vs Negative (−0.2 + 0.1 = −0.1): sale Negative porque mejora más.
    expect(result.swaps.map((s) => `${s.out.card.name}→${s.in.card.name}`)).toEqual([
      "Negative→Better",
    ]);
  });
});

describe("suggestSwaps: emparejado por rol", () => {
  it("prioriza que el que entra cumpla el mismo rol que el que sale", () => {
    const oldRamp = card("Old Ramp");
    const oldDraw = card("Old Draw");
    const newRamp = card("New Ramp");
    const newDraw = card("New Draw");
    const result = run({
      deck: deckOf([oldRamp, oldDraw]),
      recommendations: [
        rec(oldRamp, 0, 0.05),
        rec(oldDraw, 0, 0.05),
        rec(newRamp, 0.1, 0.4),
        rec(newDraw, 0.1, 0.42),
      ],
      owned: owns(newRamp, newDraw),
      classifier: fakeClassifier({
        "Old Ramp": ["ramp"],
        "New Ramp": ["ramp"],
        "Old Draw": ["draw"],
        "New Draw": ["draw"],
      }),
    });
    expect(result.swaps.map((s) => `${s.out.card.name}→${s.in.card.name}`).sort()).toEqual([
      "Old Draw→New Draw",
      "Old Ramp→New Ramp",
    ]);
    expect(result.swaps.every((s) => s.sameRole)).toBe(true);
  });

  it("no baja de los mínimos por rol", () => {
    // 10 ramp justas (mínimo 10). La peor carta es ramp, pero solo hay un robo para meter.
    const ramps = Array.from({ length: 10 }, (_, i) => card(`Ramp ${i}`));
    const pet = card("Pet");
    const draw = card("Great Draw");
    const roles: Record<string, Role[]> = Object.fromEntries(ramps.map((c) => [c.name, ["ramp"]]));
    roles["Great Draw"] = ["draw"];
    const config = mergeEngineConfig({
      minimums: { land: 0, ramp: 10, draw: 0, removal: 0, wipe: 0 },
    });
    const result = run(
      {
        deck: deckOf([...ramps, pet]),
        recommendations: [
          ...ramps.map((c) => rec(c, -0.1, 0.01)),
          rec(pet, 0, 0.2),
          rec(draw, 0.3, 0.6),
        ],
        owned: owns(draw),
        classifier: fakeClassifier(roles),
      },
      config,
    );
    expect(result.swaps.map((s) => s.out.card.name)).toEqual(["Pet"]);
  });

  it("puede cortar un rol mínimo si el que entra cumple el mismo rol", () => {
    const ramps = Array.from({ length: 10 }, (_, i) => card(`Ramp ${i}`));
    const newRamp = card("New Ramp");
    const roles: Record<string, Role[]> = Object.fromEntries(ramps.map((c) => [c.name, ["ramp"]]));
    roles["New Ramp"] = ["ramp"];
    const config = mergeEngineConfig({
      minimums: { land: 0, ramp: 10, draw: 0, removal: 0, wipe: 0 },
    });
    const result = run(
      {
        deck: deckOf(ramps),
        recommendations: [...ramps.map((c, i) => rec(c, 0, 0.1 + i / 100)), rec(newRamp, 0.2, 0.5)],
        owned: owns(newRamp),
        classifier: fakeClassifier(roles),
      },
      config,
    );
    expect(result.swaps.map((s) => `${s.out.card.name}→${s.in.card.name}`)).toEqual([
      "Ramp 0→New Ramp",
    ]);
  });

  it("premia cubrir un rol bajo mínimo y lo explica", () => {
    const pet = card("Pet");
    const removal = card("Swords to Plowshares");
    const flashy = card("Flashy");
    const config = mergeEngineConfig({
      minimums: { land: 0, ramp: 0, draw: 0, removal: 8, wipe: 0 },
    });
    const result = run(
      {
        deck: deckOf([pet]),
        recommendations: [rec(removal, 0.05, 0.4), rec(flashy, 0.1, 0.4)],
        owned: owns(removal, flashy),
        classifier: fakeClassifier({
          "Swords to Plowshares": ["removal"],
          Pet: ["synergy"],
          Flashy: ["synergy"],
        }),
      },
      config,
    );
    expect(result.deficits).toEqual([{ role: "removal", count: 0, min: 8 }]);
    // Flashy: 0.5 + 0.2·1 (mismo rol que Pet) = 0.7 · Swords: 0.45 + 0.2·0.5 (cubre mínimo) = 0.55
    expect(result.swaps[0]?.in.card.name).toBe("Flashy");

    // Sin cartas de sinergia que meter, entra el removal y el motivo lo dice.
    const only = run(
      {
        deck: deckOf([pet]),
        recommendations: [rec(removal, 0.05, 0.4)],
        owned: owns(removal),
        classifier: fakeClassifier({ "Swords to Plowshares": ["removal"], Pet: ["synergy"] }),
      },
      config,
    );
    expect(only.swaps[0]?.fillsDeficit).toEqual(["removal"]);
    expect(only.swaps[0]?.reason).toMatch(/Sube removal a 1 \(mínimo 8\)\.$/);
  });
});

describe("suggestSwaps: umbrales y configuración", () => {
  const a = card("A");
  const b = card("B");
  const c = card("C");
  const d = card("D");

  it("no propone cambios que no mejoran", () => {
    const result = run({
      deck: deckOf([a]),
      recommendations: [rec(a, 0.2, 0.4), rec(b, 0.2, 0.41)],
      owned: owns(b),
    });
    expect(result.swaps).toEqual([]);
  });

  it("cada carta entra y sale como mucho una vez, y respeta maxSuggestions", () => {
    const deck = deckOf([a, b]);
    const recs = [rec(a, 0, 0), rec(b, 0, 0), rec(c, 0.3, 0.3), rec(d, 0.2, 0.2)];
    const all = run({ deck, recommendations: recs, owned: owns(c, d) });
    expect(all.swaps).toHaveLength(2);
    expect(new Set(all.swaps.map((s) => s.in.card.name)).size).toBe(2);
    expect(new Set(all.swaps.map((s) => s.out.card.name)).size).toBe(2);

    const one = run(
      { deck, recommendations: recs, owned: owns(c, d) },
      mergeEngineConfig({ ...noMinimums, maxSuggestions: 1 }),
    );
    expect(one.swaps).toHaveLength(1);
    expect(one.swaps[0]?.in.card.name).toBe("C");
  });

  it("los pesos a y b cambian qué carta se prefiere", () => {
    const highSyn = card("High Synergy");
    const highIncl = card("High Inclusion");
    const recs = [rec(a, 0, 0), rec(highSyn, 0.5, 0.1), rec(highIncl, 0.05, 0.7)];
    const bySynergy = run(
      { deck: deckOf([a]), recommendations: recs, owned: owns(highSyn, highIncl) },
      mergeEngineConfig({ ...noMinimums, weights: { synergy: 3, inclusion: 1 } }),
    );
    expect(bySynergy.swaps[0]?.in.card.name).toBe("High Synergy");
    const byInclusion = run(
      { deck: deckOf([a]), recommendations: recs, owned: owns(highSyn, highIncl) },
      mergeEngineConfig({ ...noMinimums, weights: { synergy: 0.5, inclusion: 1 } }),
    );
    expect(byInclusion.swaps[0]?.in.card.name).toBe("High Inclusion");
  });
});

describe("suggestSwaps: recuento de roles", () => {
  it("cuenta cantidades y comandantes, y detecta déficits", () => {
    const island = card("Island", { isBasicLand: true });
    const mindStone = card("Mind Stone");
    const result = run(
      {
        deck: deckOf([island, mindStone], { Island: 30 }),
        classifier: fakeClassifier({
          Island: ["land"],
          "Mind Stone": ["ramp", "draw"],
          [commander.name]: ["draw"],
        }),
      },
      mergeEngineConfig({ minimums: { land: 35, ramp: 1, draw: 2 } }),
    );
    expect(result.roleCounts).toMatchObject({ land: 30, ramp: 1, draw: 2, removal: 0 });
    expect(result.deficits.map((d) => d.role)).toEqual(["land", "removal", "wipe"]);
  });
});

describe("suggestSwaps: identidad de color y legalidad", () => {
  const bolt = card("Lightning Bolt", { colorIdentity: ["R"] });
  const crypt = card("Mana Crypt", { colorIdentity: [], legalCommander: false });
  const ok = card("Fine Card");
  const great = card("Great Card");
  const good = card("Good Card");
  const redGreat = card("Red Great", { colorIdentity: ["U", "R"] });

  it("las cartas fuera de color o prohibidas salen primero, aunque estén en EDHREC", () => {
    const result = run({
      deck: deckOf([ok, bolt, crypt]),
      recommendations: [
        rec(ok, 0, 0.01),
        rec(bolt, 0.5, 0.9),
        rec(crypt, 0.5, 0.9),
        rec(great, 0.3, 0.6),
        rec(good, 0.2, 0.5),
      ],
      owned: owns(great, good),
    });
    expect(result.cutCandidates.slice(0, 2).map((c) => [c.card.name, c.problem])).toEqual([
      ["Lightning Bolt", "offColor"],
      ["Mana Crypt", "notLegal"],
    ]);
    expect(result.swaps.map((s) => s.out.card.name).sort()).toEqual([
      "Lightning Bolt",
      "Mana Crypt",
    ]);
    const boltSwap = result.swaps.find((s) => s.out.card.name === "Lightning Bolt");
    expect(boltSwap?.reason).toContain(
      "Lightning Bolt (sinergia, fuera de la identidad de color del comandante)",
    );
    const cryptSwap = result.swaps.find((s) => s.out.card.name === "Mana Crypt");
    expect(cryptSwap?.reason).toContain("Mana Crypt (sinergia, prohibida en Commander)");
  });

  it("una carta fuera de color sale aunque deje un rol bajo mínimo", () => {
    const config = mergeEngineConfig({
      minimums: { land: 0, ramp: 0, draw: 0, removal: 1, wipe: 0 },
    });
    const result = run(
      {
        deck: deckOf([bolt]),
        recommendations: [rec(great, 0.3, 0.6)],
        owned: owns(great),
        classifier: fakeClassifier({ "Lightning Bolt": ["removal"], "Great Card": ["draw"] }),
      },
      config,
    );
    expect(result.swaps.map((s) => s.out.card.name)).toEqual(["Lightning Bolt"]);
  });

  it("nunca propone meter cartas fuera de la identidad, aunque las tenga y estén recomendadas", () => {
    const result = run({
      deck: deckOf([ok]),
      recommendations: [rec(ok, 0, 0), rec(redGreat, 0.9, 0.9), rec(bolt, 0.9, 0.9)],
      owned: owns(redGreat, bolt),
    });
    expect(result.addCandidates).toEqual([]);
    expect(result.swaps).toEqual([]);
  });

  it("sin comandante no propone nada", () => {
    const result = run({
      deck: { ...deckOf([ok]), commanders: [], commanderSource: "none" },
      recommendations: [rec(great, 0.9, 0.9)],
      owned: owns(great),
    });
    expect(result.addCandidates).toEqual([]);
  });

  it("el mínimo de tierras por defecto es 36", () => {
    expect(DEFAULT_ENGINE_CONFIG.minimums.land).toBe(36);
  });
});
