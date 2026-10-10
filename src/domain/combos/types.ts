/**
 * Combos de Commander Spellbook. Solo lo que usamos de cada "variant": las cartas, lo que produce
 * y su etiqueta de bracket.
 */
export interface ComboCard {
  /** oracleId de Scryfall (null si Spellbook no lo da, p. ej. una carta por salir). */
  oracleId: string | null;
  name: string;
  /** Tiene que ser el comandante. */
  mustBeCommander: boolean;
}

/**
 * Etiqueta de bracket de Spellbook: R ruthless (combo temprano de dos cartas), S spicy,
 * P powerful, O oddball, C core, E exhibition, B baneado.
 */
export type ComboBracketTag = "R" | "S" | "P" | "O" | "C" | "E" | "B";

export interface Combo {
  /** Id de Spellbook (para enlazar a commanderspellbook.com/combo/{id}). */
  id: string;
  cards: ComboCard[];
  /** Lo que consigue: "Infinite colorless mana", "Win the game"… */
  produces: string[];
  /** Otras cosas que necesita (p. ej. "Una criatura con poder 1 o más"). */
  requires: string[];
  bracketTag: ComboBracketTag | null;
  /** Maná que hay que tener para hacerlo (valor de maná). */
  manaValueNeeded: number;
  /** Cuántos mazos de EDHREC lo llevan. */
  popularity: number | null;
}

export interface DeckCombos {
  /** Combos que el mazo ya tiene completos. */
  included: Combo[];
  /** Combos a los que les falta una carta (dentro de la identidad del comandante). */
  almostIncluded: Combo[];
  fetchedAt: Date;
  stale: boolean;
  warning: string | null;
}
