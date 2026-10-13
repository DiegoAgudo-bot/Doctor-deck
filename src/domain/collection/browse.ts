import { canBeCommander } from "../cards/commander";
import type { Card } from "../cards/types";
import type { Role } from "../roles/types";

/** Lo mínimo de una carta de la colección para filtrarla y ordenarla. */
export interface BrowsableCard {
  card: Pick<Card, "name" | "typeLine" | "cmc" | "colorIdentity"> &
    Partial<Pick<Card, "oracleText" | "legalCommander">>;
  roles: readonly Role[];
  quantity: number;
  foilQuantity: number;
  fromCsv: number;
  manualCount: number;
  inUse: number;
  /** Idiomas de las copias que se saben (códigos de Scryfall). */
  languages?: readonly string[] | undefined;
  /** Precio de referencia por copia (la impresión más barata). */
  price: number | null;
  /** Lo que valen mis copias según su impresión y si son foil (null si no hay ningún precio). */
  value: number | null;
  /** ISO 8601 (se compara como texto). */
  lastAdded: string;
}

export const COLOR_FILTERS = ["W", "U", "B", "R", "G", "C"] as const;
export type ColorFilter = (typeof COLOR_FILTERS)[number];
/** Con alguno de los colores, dentro de esa identidad (lo que puede jugar ese comandante) o exacta. */
export type ColorMode = "alguno" | "dentro" | "exacto";
export const CARD_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
] as const;
export type CardType = (typeof CARD_TYPES)[number];
export const COLLECTION_SORTS = [
  "nombre",
  "coste",
  "copias",
  "precio",
  "valor",
  "recientes",
] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export interface CollectionFilters {
  /** Texto en el nombre o la línea de tipo (sin tildes ni mayúsculas). */
  q?: string | undefined;
  colors?: readonly ColorFilter[] | undefined;
  colorMode?: ColorMode | undefined;
  type?: CardType | undefined;
  role?: Role | undefined;
  /** Valor de maná; 7 = 7 o más. */
  cmc?: number | undefined;
  origin?: "csv" | "manual" | undefined;
  use?: "libres" | "en-mazos" | undefined;
  foil?: boolean | undefined;
  /** Con alguna copia en este idioma (código de Scryfall). */
  language?: string | undefined;
  /** Solo las que pueden ser comandante (para empezar un mazo con lo que tengo). */
  commander?: boolean | undefined;
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const frontType = (typeLine: string) => typeLine.split("//")[0] ?? typeLine;

/** ¿Pasa el filtro de color? Incolora = identidad vacía. */
export function colorMatch(
  identity: readonly string[],
  colors: readonly ColorFilter[],
  mode: ColorMode,
): boolean {
  if (colors.length === 0) return true;
  const wantColorless = colors.includes("C");
  const want: string[] = colors.filter((c) => c !== "C");
  if (identity.length === 0) return wantColorless || mode === "dentro";
  if (mode === "alguno") return want.some((c) => identity.includes(c));
  if (mode === "dentro") return identity.every((c) => want.includes(c));
  return identity.length === want.length && want.every((c) => identity.includes(c));
}

export function matchesFilters(c: BrowsableCard, f: CollectionFilters): boolean {
  const q = norm(f.q?.trim() ?? "");
  if (q && !norm(c.card.name).includes(q) && !norm(c.card.typeLine).includes(q)) return false;
  if (!colorMatch(c.card.colorIdentity, f.colors ?? [], f.colorMode ?? "alguno")) return false;
  if (f.type && !new RegExp(`\\b${f.type}\\b`).test(frontType(c.card.typeLine))) return false;
  if (f.role && !c.roles.includes(f.role)) return false;
  if (f.cmc !== undefined) {
    const v = Math.floor(c.card.cmc);
    if (f.cmc >= 7 ? v < 7 : v !== f.cmc) return false;
  }
  if (f.origin === "csv" && c.fromCsv === 0) return false;
  if (f.origin === "manual" && c.manualCount === 0) return false;
  if (f.use === "libres" && c.quantity <= c.inUse) return false;
  if (f.use === "en-mazos" && c.inUse === 0) return false;
  if (f.foil && c.foilQuantity === 0) return false;
  if (f.language && !(c.languages ?? []).includes(f.language)) return false;
  if (f.commander && (c.card.legalCommander === false || !canBeCommander(c.card))) return false;
  return true;
}

const byName = (a: BrowsableCard, b: BrowsableCard) => a.card.name.localeCompare(b.card.name);

export type SortDir = "asc" | "desc";
/** La dirección natural de cada orden (la que se usa si no se elige otra). */
export const COLLECTION_SORT_DEFAULT_DIR: Record<CollectionSort, SortDir> = {
  nombre: "asc",
  coste: "asc",
  copias: "desc",
  precio: "desc",
  valor: "desc",
  recientes: "desc",
};

/** Lo que se compara en cada orden, de menor a mayor (null = sin dato: siempre al final). */
const KEYS: Record<
  Exclude<CollectionSort, "nombre">,
  (c: BrowsableCard) => number | string | null
> = {
  coste: (c) => c.card.cmc,
  copias: (c) => c.quantity,
  precio: (c) => c.price,
  valor: (c) => c.value,
  recientes: (c) => c.lastAdded,
};

/** Comparador de un orden y una dirección; a igualdad, por nombre (siempre A→Z). */
export function collectionSorter(
  sort: CollectionSort,
  dir: SortDir = COLLECTION_SORT_DEFAULT_DIR[sort],
): (a: BrowsableCard, b: BrowsableCard) => number {
  const sign = dir === "asc" ? 1 : -1;
  if (sort === "nombre") return (a, b) => sign * byName(a, b);
  const key = KEYS[sort];
  return (a, b) => {
    const x = key(a);
    const y = key(b);
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return sign * c || byName(a, b);
  };
}

export interface CollectionPage<T> {
  items: T[];
  /** Lo que cumple los filtros (todas las páginas). */
  total: { cards: number; copies: number; value: number };
}

/** Filtra, ordena y corta una página. `value` = lo que valen mis copias (lo que tiene precio). */
export function browseCollection<T extends BrowsableCard>(
  cards: readonly T[],
  filters: CollectionFilters,
  sort: CollectionSort,
  offset: number,
  limit: number,
  dir?: SortDir,
): CollectionPage<T> {
  const matching = cards
    .filter((c) => matchesFilters(c, filters))
    .sort(collectionSorter(sort, dir));
  return {
    items: matching.slice(offset, offset + limit),
    total: totals(matching),
  };
}

export function totals(cards: readonly BrowsableCard[]) {
  return {
    cards: cards.length,
    copies: cards.reduce((n, c) => n + c.quantity, 0),
    value: Math.round(cards.reduce((n, c) => n + (c.value ?? 0), 0) * 100) / 100,
  };
}
