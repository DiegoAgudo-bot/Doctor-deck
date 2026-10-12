import { COLORS, type Color } from "./types";

/** Tipos de carta por los que se puede filtrar el buscador (en el `typeLine` en inglés). */
export const CARD_TYPES = {
  creature: "Criatura",
  instant: "Instantáneo",
  sorcery: "Conjuro",
  artifact: "Artefacto",
  enchantment: "Encantamiento",
  planeswalker: "Planeswalker",
  land: "Tierra",
  battle: "Batalla",
} as const;
export type CardType = keyof typeof CARD_TYPES;

/**
 * Cómo se comparan los colores elegidos con la identidad de color de la carta:
 * `within` = cabe en esos colores (lo útil para un mazo), `exact` = exactamente esos,
 * `includes` = tiene al menos esos.
 */
export type ColorMode = "within" | "exact" | "includes";

export const CATALOG_SORTS = ["popular", "name", "cmc", "price"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export type SortDir = "asc" | "desc";

/** La dirección natural de cada orden (la que se usa si no se elige otra). */
export const CATALOG_SORT_DEFAULT_DIR: Record<CatalogSort, SortDir> = {
  popular: "desc",
  name: "asc",
  cmc: "asc",
  price: "desc",
};

export interface CatalogQuery {
  /** Texto en el nombre, el tipo o el texto de reglas. */
  text: string;
  colors: Color[];
  colorMode: ColorMode;
  /** Sin colores elegidos y con `colorless`, solo las incoloras. */
  colorless: boolean;
  type: CardType | null;
  /** Solo las que pueden ser comandante. */
  commander: boolean;
  /** Solo game changers. */
  gameChanger: boolean;
  /** Coste de maná convertido (null = cualquiera; 7 = 7 o más). */
  cmc: number | null;
  /** Precio mínimo y máximo (EUR) de la impresión más barata. */
  minPrice: number | null;
  maxPrice: number | null;
  sort: CatalogSort;
  /** null = la natural del orden (`CATALOG_SORT_DEFAULT_DIR`). */
  dir: SortDir | null;
}

export const catalogSortDir = (q: Pick<CatalogQuery, "sort" | "dir">): SortDir =>
  q.dir ?? CATALOG_SORT_DEFAULT_DIR[q.sort];

export const EMPTY_CATALOG_QUERY: CatalogQuery = {
  text: "",
  colors: [],
  colorMode: "within",
  colorless: false,
  type: null,
  commander: false,
  gameChanger: false,
  cmc: null,
  minPrice: null,
  maxPrice: null,
  sort: "popular",
  dir: null,
};

function priceParam(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
}

/** Lee la consulta de los parámetros de la URL (tolerante: lo que no entiende, lo ignora). */
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const colorsParam = (params.get("colors") ?? "").toUpperCase();
  const mode = params.get("mode");
  const type = params.get("type");
  const sort = params.get("sort");
  const cmc = params.get("cmc");
  const cmcN = cmc === null || cmc === "" ? null : Number(cmc);
  const dir = params.get("dir");
  const parsedSort: CatalogSort = CATALOG_SORTS.find((s) => s === sort) ?? "popular";
  return {
    text: (params.get("q") ?? "").trim().slice(0, 100),
    colors: COLORS.filter((c) => colorsParam.includes(c)),
    colorMode: mode === "exact" || mode === "includes" ? mode : "within",
    colorless: colorsParam === "C",
    type: type && type in CARD_TYPES ? (type as CardType) : null,
    commander: params.get("commander") === "1",
    gameChanger: params.get("gc") === "1",
    cmc: cmcN !== null && Number.isInteger(cmcN) && cmcN >= 0 && cmcN <= 7 ? cmcN : null,
    minPrice: priceParam(params.get("min")),
    maxPrice: priceParam(params.get("max")),
    sort: parsedSort,
    dir:
      (dir === "asc" || dir === "desc") && dir !== CATALOG_SORT_DEFAULT_DIR[parsedSort]
        ? dir
        : null,
  };
}

/** Lo contrario: los parámetros de la URL de una consulta (sin los que valen por defecto). */
export function catalogQueryParams(q: CatalogQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.text) p.set("q", q.text);
  if (q.colorless) p.set("colors", "C");
  else if (q.colors.length) p.set("colors", q.colors.join(""));
  if (q.colorMode !== "within" && q.colors.length) p.set("mode", q.colorMode);
  if (q.type) p.set("type", q.type);
  if (q.commander) p.set("commander", "1");
  if (q.gameChanger) p.set("gc", "1");
  if (q.cmc !== null) p.set("cmc", String(q.cmc));
  if (q.minPrice !== null) p.set("min", String(q.minPrice));
  if (q.maxPrice !== null) p.set("max", String(q.maxPrice));
  if (q.sort !== "popular") p.set("sort", q.sort);
  if (q.dir !== null && q.dir !== CATALOG_SORT_DEFAULT_DIR[q.sort]) p.set("dir", q.dir);
  return p;
}

/** Si la consulta no filtra nada (entonces se enseñan las más jugadas). */
export const isEmptyQuery = (q: CatalogQuery) =>
  !q.text &&
  !q.colors.length &&
  !q.colorless &&
  !q.type &&
  !q.commander &&
  !q.gameChanger &&
  q.cmc === null &&
  q.minPrice === null &&
  q.maxPrice === null;
