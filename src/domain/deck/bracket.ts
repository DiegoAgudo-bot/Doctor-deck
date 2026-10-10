import { rulesText } from "../cards/rules-text";
import type { Card } from "../cards/types";
import type { Role } from "../roles/types";

/**
 * Brackets de Commander (WotC, 2025): 1 Exhibición, 2 Básico, 3 Mejorado, 4 Optimizado, 5 cEDH.
 * Lo que se puede comprobar en una lista: game changers, destrucción masiva de tierras y turnos
 * extra. Los combos de dos cartas se comprobarán con Commander Spellbook (fase 16). Lo que no se
 * puede saber de una lista (intención, si es temático, si es cEDH) no se estima: el resultado es
 * el bracket MÍNIMO en el que encaja el mazo (2, 3 o 4).
 */
export const BRACKETS = [1, 2, 3, 4, 5] as const;
export type Bracket = (typeof BRACKETS)[number];

export const BRACKET_NAMES: Record<Bracket, string> = {
  1: "Exhibición",
  2: "Básico",
  3: "Mejorado",
  4: "Optimizado",
  5: "cEDH",
};

/** Lo que llega de la BD: un número fuera de 1–5 (o null) es "sin objetivo". */
export const toBracket = (v: number | null): Bracket | null =>
  BRACKETS.find((b) => b === v) ?? null;

/** Máximo de game changers por bracket. */
export const GAME_CHANGER_LIMIT: Record<Bracket, number> = {
  1: 0,
  2: 0,
  3: 3,
  4: Infinity,
  5: Infinity,
};
/** Hasta el bracket 3 no se admite destrucción masiva de tierras. */
export const allowsMassLandDenial = (b: Bracket) => b >= 4;
/** A partir de cuántas cartas de turno extra se considera que se pueden encadenar. */
export const EXTRA_TURN_CHAIN = 3;

const MASS_LAND_DENIAL: RegExp[] = [
  // Armageddon, Ravages of War, Ruination, Catastrophe…
  /\b(?:destroy|exile|return) all (?:non[a-z]+ )?lands\b/,
  /\b(?:destroy|exile) all (?:artifacts?, )?(?:creatures?,? )?(?:and )?lands\b/,
  // Wildfire, Destructive Force, Jokulhaups-like: "each player sacrifices four lands"
  /\beach (?:other )?(?:player|opponent) sacrifices (?:all|two|three|four|five|six|seven|x|half the|that many) (?:of their )?(?:untapped )?lands\b/,
  // Blood Moon, Magus of the Moon, Back to Basics, Winter Orb, Static Orb, Hokori…
  /\bnonbasic lands are \w+/,
  /\bnonbasic lands don't untap\b/,
  // "lands don't untap", pero no "up to three target lands don't untap" (Rubble).
  /(?<!target )\blands don't untap during\b/,
  /\bplayers can't untap more than (?:one|two) lands?\b/,
];

const EXTRA_TURN = /\btakes? (?:an|one|two|x|that many) extra turns?\b/;

export const isMassLandDenial = (card: Card) => {
  const text = rulesText(card);
  return MASS_LAND_DENIAL.some((re) => re.test(text));
};
export const isExtraTurn = (card: Card) => EXTRA_TURN.test(rulesText(card));

export interface BracketEstimate {
  /** Bracket mínimo en el que encaja la lista (2 si no hay nada que la suba). */
  bracket: 2 | 3 | 4;
  gameChangers: string[];
  massLandDenial: string[];
  extraTurns: string[];
  tutors: string[];
  /** Por qué ese bracket, en español. */
  reasons: string[];
  /** Combos de dos cartas: todavía sin comprobar. */
  combosChecked: false;
}

const list = (names: string[]) =>
  names.length <= 3
    ? names.join(", ")
    : `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`;

/** Estima el bracket de un mazo (comandantes incluidos). */
export function estimateBracket(
  cards: readonly { card: Card; roles: readonly Role[] }[],
): BracketEstimate {
  const names = (pred: (c: { card: Card; roles: readonly Role[] }) => boolean) =>
    [...new Set(cards.filter(pred).map((c) => c.card.name))].sort();
  const gameChangers = names((c) => c.card.gameChanger);
  const massLandDenial = names((c) => isMassLandDenial(c.card));
  const extraTurns = names((c) => isExtraTurn(c.card));
  const tutors = names((c) => c.roles.includes("tutor"));

  const reasons: string[] = [];
  let bracket: 2 | 3 | 4 = 2;
  if (gameChangers.length > GAME_CHANGER_LIMIT[3]) {
    bracket = 4;
    reasons.push(`${gameChangers.length} game changers (el bracket 3 admite hasta 3)`);
  } else if (gameChangers.length > 0) {
    bracket = 3;
    reasons.push(
      `${gameChangers.length} game changer${gameChangers.length > 1 ? "s" : ""}: ${list(gameChangers)}`,
    );
  }
  if (massLandDenial.length > 0) {
    bracket = 4;
    reasons.push(`Destrucción masiva de tierras: ${list(massLandDenial)}`);
  }
  if (extraTurns.length >= EXTRA_TURN_CHAIN) {
    bracket = 4;
    reasons.push(`${extraTurns.length} cartas de turno extra: se pueden encadenar`);
  }
  if (reasons.length === 0)
    reasons.push("Sin game changers, destrucción masiva de tierras ni turnos extra encadenados");
  return {
    bracket,
    gameChangers,
    massLandDenial,
    extraTurns,
    tutors,
    reasons,
    combosChecked: false,
  };
}
