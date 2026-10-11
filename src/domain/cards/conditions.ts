/**
 * Estado de una copia, con los mismos valores que exporta ManaBox en `Condition`. Como el idioma,
 * es solo información de la copia: el análisis sigue siendo por carta.
 */
export const CONDITIONS = {
  mint: { short: "M", label: "Mint" },
  near_mint: { short: "NM", label: "Near Mint" },
  excellent: { short: "EX", label: "Excellent" },
  good: { short: "GD", label: "Good" },
  lightly_played: { short: "LP", label: "Lightly Played" },
  played: { short: "PL", label: "Played" },
  poor: { short: "PO", label: "Poor" },
} as const;

export type Condition = keyof typeof CONDITIONS;
export const CONDITION_CODES = Object.keys(CONDITIONS) as Condition[];

/** Otros nombres habituales (abreviaturas, TCGplayer, Cardmarket). */
const ALIASES: Record<string, Condition> = {
  m: "mint",
  nm: "near_mint",
  "near mint": "near_mint",
  ex: "excellent",
  gd: "good",
  lp: "lightly_played",
  light_played: "lightly_played",
  "lightly played": "lightly_played",
  sp: "lightly_played",
  "slightly played": "lightly_played",
  pl: "played",
  mp: "played",
  "moderately played": "played",
  moderately_played: "played",
  hp: "poor",
  "heavily played": "poor",
  heavily_played: "poor",
  po: "poor",
  damaged: "poor",
  dmg: "poor",
};

export function normalizeCondition(value: string | null | undefined): Condition | null {
  const v = value?.trim().toLowerCase() ?? "";
  if (v === "") return null;
  if (v in CONDITIONS) return v as Condition;
  return ALIASES[v] ?? ALIASES[v.replace(/_/g, " ")] ?? null;
}

export const conditionShort = (c: string) => CONDITIONS[c as Condition]?.short ?? c.toUpperCase();
export const conditionLabel = (c: string) => CONDITIONS[c as Condition]?.label ?? c;
