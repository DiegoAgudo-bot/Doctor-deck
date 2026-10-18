import { statValue, subtypesOf, type Rarity, type Supertype } from "../cards/attributes";
import { canBeCommander } from "../cards/commander";
import type { LocalizedText } from "../cards/localized";
import type { Card } from "../cards/types";
import type { Role } from "../roles/types";

/** Lo mínimo de una carta de la colección para filtrarla y ordenarla. */
export interface BrowsableCard {
  card: Pick<Card, "name" | "typeLine" | "cmc" | "colorIdentity"> &
    Partial<
      Pick<
        Card,
        | "oracleText"
        | "legalCommander"
        | "keywords"
        | "gameChanger"
        | "colors"
        | "power"
        | "toughness"
        | "loyalty"
      >
    >;
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
  /** Ediciones (códigos), rarezas, estados y artistas de mis copias, de las que se saben. */
  sets?: readonly string[] | undefined;
  rarities?: readonly string[] | undefined;
  conditions?: readonly string[] | undefined;
  artists?: readonly string[] | undefined;
  /** Lo impreso en otros idiomas (para buscar escribiendo en cualquier idioma). */
  localized?: readonly LocalizedText[] | undefined;
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

  // Como los de ManaBox:
  /** Texto de reglas (sin tildes ni mayúsculas). */
  text?: string | undefined;
  /** Los colores comparan la identidad (por defecto) o los colores de la carta. */
  colorBy?: "identity" | "color" | undefined;
  /** Con alguno de estos tipos (además de `type`). */
  types?: readonly CardType[] | undefined;
  /** Con todos estos supertipos (legendaria, básica, nevada). */
  supertypes?: readonly Supertype[] | undefined;
  /** Texto en los subtipos ("elf", "equipment"). */
  subtype?: string | undefined;
  /** Con esta habilidad clave ("flying", o en otro idioma: "vuela"). */
  keyword?: string | undefined;
  /**
   * Las habilidades (en inglés) a las que se refiere `keyword` en otros idiomas (`keywordsFor`).
   * No viene de la API: la rellena el caso de uso.
   */
  keywordMatches?: readonly string[] | undefined;
  /** Valor de maná entre estos (incluidos). */
  cmcMin?: number | undefined;
  cmcMax?: number | undefined;
  powerMin?: number | undefined;
  powerMax?: number | undefined;
  toughnessMin?: number | undefined;
  toughnessMax?: number | undefined;
  loyaltyMin?: number | undefined;
  loyaltyMax?: number | undefined;
  /** Alguna copia de estas rarezas, ediciones (códigos) o estados. */
  rarities?: readonly Rarity[] | undefined;
  sets?: readonly string[] | undefined;
  conditions?: readonly string[] | undefined;
  /** Texto en el artista de alguna copia. */
  artist?: string | undefined;
  /** "foil" = alguna copia foil; "nonfoil" = alguna normal. */
  finish?: "foil" | "nonfoil" | undefined;
  /** Precio por copia (`unitPrice`) entre estos, en EUR. */
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  /** Al menos estas copias (2 = repetidas). */
  quantityMin?: number | undefined;
  /** Añadidas desde esta fecha (ISO 8601). */
  addedSince?: string | undefined;
  gameChanger?: boolean | undefined;
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Textos ya normalizados para buscar, calculados una vez por objeto: la vista de la colección se
 * guarda en caché y se vuelve a filtrar en cada pulsación del buscador, y normalizar el nombre y el
 * tipo de miles de cartas en varios idiomas cada vez se notaba (cientos de ms por búsqueda).
 */
const searchKeys = new WeakMap<object, Map<string, string>>();
/** Separa los textos unidos para que lo buscado no case a caballo entre dos. */
const SEP = "\u0000";
function searchKeyOf(owner: object, field: string, build: () => string): string {
  let keys = searchKeys.get(owner);
  if (!keys) {
    keys = new Map();
    searchKeys.set(owner, keys);
  }
  let key = keys.get(field);
  if (key === undefined) {
    key = build();
    keys.set(field, key);
  }
  return key;
}

/** ¿Está `q` (ya normalizado) en lo de la carta o en lo impreso en otros idiomas? */
function textMatch(
  c: BrowsableCard,
  q: string,
  field: string,
  ofCard: (card: BrowsableCard["card"]) => string,
  ofLocalized: (l: LocalizedText) => string | null,
): boolean {
  if (searchKeyOf(c.card, field, () => norm(ofCard(c.card))).includes(q)) return true;
  const localized = c.localized;
  if (!localized?.length) return false;
  return searchKeyOf(localized, field, () =>
    localized.map((l) => norm(ofLocalized(l) ?? "")).join(SEP),
  ).includes(q);
}
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

/** ¿Está `v` entre `min` y `max` (los que haya)? Sin valor no pasa si se pide algún límite. */
function inRange(v: number | null, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined && max === undefined) return true;
  if (v === null) return false;
  return (min === undefined || v >= min) && (max === undefined || v <= max);
}

const hasType = (typeLine: string, type: string) =>
  new RegExp(`\\b${type}\\b`).test(frontType(typeLine));

/** ¿Alguno de `have` está en `want`? (sin mayúsculas). */
const anyOf = (have: readonly string[] | undefined, want: readonly string[]) => {
  const w = new Set(want.map((x) => x.toLowerCase()));
  return (have ?? []).some((h) => w.has(h.toLowerCase()));
};

/** Lo escrito en un filtro de texto, listo para comparar (sin el separador interno). */
const searchText = (s: string | undefined) => norm(s?.trim() ?? "").replaceAll(SEP, "");

export function matchesFilters(c: BrowsableCard, f: CollectionFilters): boolean {
  // Lo escrito vale en cualquier idioma: también se mira lo impreso en otros idiomas.
  const q = searchText(f.q);
  if (
    q &&
    !textMatch(
      c,
      q,
      "nameType",
      (card) => card.name + SEP + card.typeLine,
      (l) => l.name + SEP + (l.typeLine ?? ""),
    )
  ) {
    return false;
  }
  const text = searchText(f.text);
  if (
    text &&
    !textMatch(
      c,
      text,
      "text",
      (card) => card.oracleText ?? "",
      (l) => l.text,
    )
  ) {
    return false;
  }
  const colorsOf =
    f.colorBy === "color" ? (c.card.colors ?? c.card.colorIdentity) : c.card.colorIdentity;
  if (!colorMatch(colorsOf, f.colors ?? [], f.colorMode ?? "alguno")) return false;
  if (f.type && !hasType(c.card.typeLine, f.type)) return false;
  if (f.types?.length && !f.types.some((t) => hasType(c.card.typeLine, t))) return false;
  if (f.supertypes?.length && !f.supertypes.every((t) => hasType(c.card.typeLine, t))) {
    return false;
  }
  const subtype = searchText(f.subtype);
  if (
    subtype &&
    !textMatch(
      c,
      subtype,
      "subtype",
      (card) => subtypesOf(card.typeLine),
      (l) => (l.typeLine ? subtypesOf(l.typeLine) : null),
    )
  ) {
    return false;
  }
  const keyword = norm(f.keyword?.trim() ?? "");
  if (
    keyword &&
    !(c.card.keywords ?? []).some(
      (k) => norm(k).includes(keyword) || (f.keywordMatches ?? []).includes(k),
    )
  ) {
    return false;
  }
  if (!inRange(c.card.cmc, f.cmcMin, f.cmcMax)) return false;
  if (!inRange(statValue(c.card.power), f.powerMin, f.powerMax)) return false;
  if (!inRange(statValue(c.card.toughness), f.toughnessMin, f.toughnessMax)) return false;
  if (!inRange(statValue(c.card.loyalty), f.loyaltyMin, f.loyaltyMax)) return false;
  if (f.rarities?.length && !anyOf(c.rarities, f.rarities)) return false;
  if (f.sets?.length && !anyOf(c.sets, f.sets)) return false;
  if (f.conditions?.length && !anyOf(c.conditions, f.conditions)) return false;
  const artist = norm(f.artist?.trim() ?? "");
  if (artist && !(c.artists ?? []).some((a) => norm(a).includes(artist))) return false;
  if (f.finish === "foil" && c.foilQuantity === 0) return false;
  if (f.finish === "nonfoil" && c.foilQuantity >= c.quantity) return false;
  if (!inRange(unitPrice(c), f.priceMin, f.priceMax)) return false;
  if (f.quantityMin !== undefined && c.quantity < f.quantityMin) return false;
  if (f.addedSince && c.lastAdded < f.addedSince) return false;
  if (f.gameChanger && !c.card.gameChanger) return false;
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

/** Igual que `localeCompare`, pero sin crear un comparador en cada llamada (se ordenan miles). */
const collator = new Intl.Collator();
const byName = (a: BrowsableCard, b: BrowsableCard) => collator.compare(a.card.name, b.card.name);

/**
 * Lo que vale cada copia mía: según su edición y si es foil (`value` / copias). Si no se sabe, el
 * de la impresión más barata. Es lo que ordena «precio por copia» y lo que se enseña en ese orden.
 */
export function unitPrice(c: Pick<BrowsableCard, "value" | "price" | "quantity">): number | null {
  if (c.value !== null && c.quantity > 0) return Math.round((c.value / c.quantity) * 100) / 100;
  return c.price;
}

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
  precio: (c) => unitPrice(c),
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
