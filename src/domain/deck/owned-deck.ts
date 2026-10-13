import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card, Color } from "../cards/types";
import { exportDecklist } from "./export";

/** Una carta recomendada para el comandante (sinergia e inclusión en 0..1, como en EDHREC). */
export interface OwnedDeckCandidate {
  card: Card;
  synergy: number | null;
  inclusion: number | null;
}

export interface OwnedDeckInput {
  commanders: readonly Card[];
  recommendations: readonly OwnedDeckCandidate[];
  /** Copias libres de cada carta (tengo − usadas en mis otros mazos), por oracleId. */
  free: ReadonlyMap<string, number>;
  /** Tierras del mazo (por defecto 36, el mínimo del motor). */
  lands?: number | undefined;
  /** Cartas además de los comandantes (99 con uno, 98 con pareja). */
  size?: number | undefined;
}

export interface OwnedDeck {
  /** La lista en texto (Commander / Deck). */
  input: string;
  /** Hechizos (no tierras) recomendados que tengo y entran. */
  spells: number;
  nonbasicLands: number;
  basics: number;
  /** Hechizos que faltan para llegar al tamaño (no tengo suficientes recomendados). */
  missing: number;
}

const BASIC: Record<Color, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

const isLand = (c: Card) => /\bLand\b/.test(c.typeLine.split("//")[0] ?? c.typeLine);
const score = (r: OwnedDeckCandidate) => (r.inclusion ?? 0) + (r.synergy ?? 0);

/** Reparte `n` básicas entre los colores (las sobrantes, a los primeros); incoloro → Wastes. */
function basicsFor(identity: readonly Color[], n: number): [string, number][] {
  if (n <= 0) return [];
  if (identity.length === 0) return [["Wastes", n]];
  const each = Math.floor(n / identity.length);
  const extra = n % identity.length;
  return identity
    .map((c, i): [string, number] => [BASIC[c], each + (i < extra ? 1 : 0)])
    .filter(([, q]) => q > 0);
}

/**
 * Mazo «con mis cartas»: de lo que EDHREC recomienda para el comandante, las que tengo libres,
 * legales y de su identidad, de más a menos jugadas (inclusión + sinergia). Hasta `lands` tierras
 * (las no básicas que tengo y el resto básicas de sus colores) y el resto hechizos. Si no tengo
 * bastantes hechizos recomendados, el mazo se queda corto y `missing` dice cuántos faltan.
 */
export function buildOwnedDeck(input: OwnedDeckInput): OwnedDeck {
  const lands = input.lands ?? 36;
  const size = input.size ?? 100 - input.commanders.length;
  const identity = combinedColorIdentity(input.commanders);
  const commanderIds = new Set(input.commanders.map((c) => c.oracleId));

  const seen = new Set<string>();
  const candidates = [...input.recommendations]
    .filter((r) => {
      const c = r.card;
      if (seen.has(c.oracleId)) return false;
      seen.add(c.oracleId);
      return (
        !commanderIds.has(c.oracleId) &&
        !c.isBasicLand &&
        c.legalCommander &&
        (input.free.get(c.oracleId) ?? 0) > 0 &&
        fitsColorIdentity(c, identity)
      );
    })
    .sort((a, b) => score(b) - score(a));

  const landCards = candidates.filter((r) => isLand(r.card)).slice(0, lands);
  const spellCards = candidates.filter((r) => !isLand(r.card)).slice(0, size - lands);
  const basics = basicsFor(identity, lands - landCards.length);

  const text = exportDecklist({
    commanders: input.commanders.map((c) => ({ oracleId: c.oracleId, name: c.name })),
    cards: [
      ...[...spellCards, ...landCards].map((r) => ({
        oracleId: r.card.oracleId,
        name: r.card.name,
        quantity: 1,
      })),
      ...basics.map(([name, quantity]) => ({ oracleId: `basic:${name}`, name, quantity })),
    ],
  });
  return {
    input: text,
    spells: spellCards.length,
    nonbasicLands: landCards.length,
    basics: basics.reduce((n, [, q]) => n + q, 0),
    missing: size - lands - spellCards.length,
  };
}
