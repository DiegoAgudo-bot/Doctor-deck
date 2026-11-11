/**
 * Datos de un mazo para la pestaña de estadísticas (web y app): curva de maná apilada por color
 * y el resumen (tierras, hechizos y coste medio). Puro y sin imports: lo usa también la app.
 */

export interface FactsCard {
  card: { typeLine: string; cmc: number; colorIdentity: readonly string[] };
  quantity: number;
}

/** Tramo de color de una carta en la curva: su color si solo tiene uno, multicolor o incoloro. */
export type CurveSeg = "w" | "u" | "b" | "r" | "g" | "m" | "c";
export const CURVE_SEGS: readonly CurveSeg[] = ["w", "u", "b", "r", "g", "m", "c"];

const isLand = (c: FactsCard["card"]) => /\bLand\b/.test(c.typeLine.split("//")[0] ?? "");

export function curveSeg(card: FactsCard["card"]): CurveSeg {
  if (card.colorIdentity.length === 0) return "c";
  if (card.colorIdentity.length > 1) return "m";
  const seg = (card.colorIdentity[0] ?? "c").toLowerCase();
  return (CURVE_SEGS as readonly string[]).includes(seg) ? (seg as CurveSeg) : "c";
}

export interface ColorCurve {
  /** Ocho columnas (0…6 y 7+): copias de cada tramo de color, en el orden de `CURVE_SEGS`. */
  columns: { total: number; segs: { seg: CurveSeg; count: number }[] }[];
  /** La columna más alta (al menos 1, para dividir). */
  max: number;
  /** Tramos que aparecen en alguna columna (para la leyenda). */
  used: CurveSeg[];
  spells: number;
}

/** Curva de maná de lo que no es tierra, apilada por color (identidad de cada carta). */
export function curveByColor(cards: readonly FactsCard[]): ColorCurve {
  const cols = Array.from({ length: 8 }, () => new Map<CurveSeg, number>());
  let spells = 0;
  for (const { card, quantity } of cards) {
    if (isLand(card)) continue;
    const col = cols[Math.min(7, Math.max(0, Math.floor(card.cmc)))]!;
    const seg = curveSeg(card);
    col.set(seg, (col.get(seg) ?? 0) + quantity);
    spells += quantity;
  }
  const columns = cols.map((col) => {
    const segs = CURVE_SEGS.filter((s) => col.has(s)).map((seg) => ({ seg, count: col.get(seg)! }));
    return { total: segs.reduce((n, s) => n + s.count, 0), segs };
  });
  return {
    columns,
    max: Math.max(1, ...columns.map((c) => c.total)),
    used: CURVE_SEGS.filter((s) => cols.some((c) => c.has(s))),
    spells,
  };
}

/** Tierras, hechizos y coste medio de los hechizos (0 si no hay ninguno). */
export function deckSummary(cards: readonly FactsCard[]) {
  let lands = 0;
  let spells = 0;
  let cmc = 0;
  for (const { card, quantity } of cards) {
    if (isLand(card)) lands += quantity;
    else {
      spells += quantity;
      cmc += card.cmc * quantity;
    }
  }
  return { lands, spells, averageCmc: spells ? cmc / spells : 0 };
}
