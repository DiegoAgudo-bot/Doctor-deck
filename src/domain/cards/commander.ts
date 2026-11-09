import type { Card, Color } from "./types";
import { COLORS } from "./types";

type Typed = Pick<Card, "typeLine">;
const isLegendary = (c: Typed) => /\bLegendary\b/.test(c.typeLine);
const isCreature = (c: Typed) => /\bCreature\b/.test(frontTypeLine(c));
const isBackground = (c: Typed) => /\bBackground\b/.test(c.typeLine);

/** En cartas de dos caras solo cuenta la cara frontal para ser comandante. */
function frontTypeLine(c: Typed): string {
  return c.typeLine.split("//")[0] ?? c.typeLine;
}

/**
 * Vehículos y naves (Spacecraft) legendarios con fuerza y resistencia: pueden ser comandante desde
 * Edge of Eternities (regla 903.3). Las naves sin recuadro de fuerza/resistencia, no.
 */
const isCrewedCommander = (c: Typed & { power?: string | null }) =>
  /\b(Vehicle|Spacecraft)\b/.test(frontTypeLine(c)) &&
  c.power !== undefined &&
  c.power !== null &&
  c.power !== "";

/**
 * ¿Puede esta carta ser comandante (sola o como pareja)? Solo mira el tipo, el texto y (para
 * vehículos y naves) si tiene fuerza. Criaturas legendarias, «can be your commander»
 * (planeswalkers como Teferi), trasfondos legendarios y vehículos o naves legendarios con fuerza y
 * resistencia.
 */
export function canBeCommander(
  card: Pick<Card, "typeLine"> & { oracleText?: string | null; power?: string | null },
): boolean {
  if (/can be your commander/i.test(card.oracleText ?? "")) return true;
  if (isBackground(card) && isLegendary(card)) return true;
  if (!isLegendary(card)) return false;
  return isCreature(card) || isCrewedCommander(card);
}

type PairKind = "partner" | "friendsForever" | "doctorsCompanion" | "chooseBackground";

function pairKinds(card: Card): Set<PairKind> {
  const kinds = new Set<PairKind>();
  const kw = card.keywords.map((k) => k.toLowerCase());
  const text = card.oracleText ?? "";
  if (kw.includes("partner") || /^Partner\b/m.test(text)) kinds.add("partner");
  if (kw.includes("friends forever")) kinds.add("friendsForever");
  if (kw.includes("doctor's companion")) kinds.add("doctorsCompanion");
  if (/Choose a Background/i.test(text)) kinds.add("chooseBackground");
  return kinds;
}

/** "Partner with X": solo puede emparejarse con X. */
function partnerWithName(card: Card): string | null {
  const m = /Partner with ([^\n(]+?)\s*(?:\(|$)/m.exec(card.oracleText ?? "");
  return m?.[1]?.trim() ?? null;
}

/** ¿Es válida esta combinación de 1 o 2 comandantes? */
export function isValidCommanderPair(a: Card, b?: Card): boolean {
  if (!canBeCommander(a)) return false;
  if (!b) return !isBackground(a);
  if (!canBeCommander(b)) return false;
  const ka = pairKinds(a);
  const kb = pairKinds(b);

  const pa = partnerWithName(a);
  const pb = partnerWithName(b);
  if (pa || pb) return pa === b.name && pb === a.name;

  if (ka.has("partner") && kb.has("partner")) return true;
  if (ka.has("friendsForever") && kb.has("friendsForever")) return true;
  if (ka.has("chooseBackground") && isBackground(b)) return true;
  if (kb.has("chooseBackground") && isBackground(a)) return true;
  const isDoctor = (c: Card) => /\bTime Lord Doctor\b/.test(c.typeLine);
  if (ka.has("doctorsCompanion") && isDoctor(b)) return true;
  if (kb.has("doctorsCompanion") && isDoctor(a)) return true;
  return false;
}

/** Identidad de color combinada de los comandantes, en orden WUBRG. */
export function combinedColorIdentity(commanders: readonly Card[]): Color[] {
  const set = new Set(commanders.flatMap((c) => c.colorIdentity));
  return COLORS.filter((c) => set.has(c));
}

/** ¿Cabe la carta en la identidad de color dada? */
export function fitsColorIdentity(card: Card, identity: readonly Color[]): boolean {
  return card.colorIdentity.every((c) => identity.includes(c));
}
