/** Rarezas de Scryfall, de menos a más rara (las «special»/«bonus» al final). */
export const RARITIES = ["common", "uncommon", "rare", "mythic", "special", "bonus"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Común",
  uncommon: "Infrecuente",
  rare: "Rara",
  mythic: "Mítica",
  special: "Especial",
  bonus: "Bonus",
};

export const isRarity = (v: unknown): v is Rarity =>
  typeof v === "string" && (RARITIES as readonly string[]).includes(v);

/** Supertipos por los que se puede filtrar (en la línea de tipo en inglés). */
export const SUPERTYPES = ["Legendary", "Basic", "Snow"] as const;
export type Supertype = (typeof SUPERTYPES)[number];
export const SUPERTYPE_LABELS: Record<Supertype, string> = {
  Legendary: "Legendaria",
  Basic: "Básica",
  Snow: "Nevada",
};

/**
 * Valor numérico de una fuerza, resistencia o lealtad: "3" → 3, "*" → 0, "1+*" → 1, "2.5" → 2.5
 * (como Scryfall al comparar). null si no tiene ("X" también cuenta como 0).
 */
export function statValue(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const m = /^[+-]?\d+(?:\.\d+)?/.exec(v.trim().replace("½", ".5"));
  if (m) return Number(m[0]);
  return /^[*Xx?∞]/.test(v.trim()) ? 0 : null;
}

/** Subtipos de una línea de tipo (lo que va tras «—», de todas las caras). */
export const subtypesOf = (typeLine: string): string =>
  typeLine
    .split("//")
    .map((face) => face.split("—")[1]?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
