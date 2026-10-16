import type { CollectionFilters } from "@/domain/collection/browse";

/** Filtros de la colección y del buscador, como los de ManaBox (mismos valores que la API). */

export const COLOR_KEYS = ["W", "U", "B", "R", "G", "C"] as const;
export const COLOR_NAMES: Record<string, string> = {
  W: "Blanco",
  U: "Azul",
  B: "Negro",
  R: "Rojo",
  G: "Verde",
  C: "Incoloro",
};

/** Tipos: valor de la colección (en inglés, como la línea de tipo), del buscador y etiqueta. */
export const TYPE_OPTIONS = [
  { key: "Creature", catalog: "creature", label: "Criatura" },
  { key: "Instant", catalog: "instant", label: "Instantáneo" },
  { key: "Sorcery", catalog: "sorcery", label: "Conjuro" },
  { key: "Artifact", catalog: "artifact", label: "Artefacto" },
  { key: "Enchantment", catalog: "enchantment", label: "Encantamiento" },
  { key: "Planeswalker", catalog: "planeswalker", label: "Planeswalker" },
  { key: "Land", catalog: "land", label: "Tierra" },
  { key: "Battle", catalog: "battle", label: "Batalla" },
] as const;
export type TypeKey = (typeof TYPE_OPTIONS)[number]["key"];

export const SUPERTYPE_OPTIONS = [
  { key: "Legendary", label: "Legendaria" },
  { key: "Basic", label: "Básica" },
  { key: "Snow", label: "Nevada" },
] as const;
export type SupertypeKey = (typeof SUPERTYPE_OPTIONS)[number]["key"];

export const RARITY_OPTIONS = [
  { key: "common", label: "Común" },
  { key: "uncommon", label: "Infrecuente" },
  { key: "rare", label: "Rara" },
  { key: "mythic", label: "Mítica" },
  { key: "special", label: "Especial" },
  { key: "bonus", label: "Bonus" },
] as const;
export type RarityKey = (typeof RARITY_OPTIONS)[number]["key"];

export const ROLE_OPTIONS = [
  { key: "ramp", label: "Ramp" },
  { key: "draw", label: "Robo" },
  { key: "removal", label: "Removal" },
  { key: "wipe", label: "Barrido" },
  { key: "counterspell", label: "Contrahechizo" },
  { key: "tutor", label: "Tutor" },
  { key: "protection", label: "Protección" },
  { key: "land", label: "Tierra" },
  { key: "synergy", label: "Sinergia" },
] as const;

export const ADDED_OPTIONS = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "3 meses" },
  { days: 365, label: "1 año" },
] as const;

/** Un rango escrito a mano: texto tal cual (se convierte al pedir). */
export interface Range {
  min: string;
  max: string;
}
const EMPTY_RANGE: Range = { min: "", max: "" };

export interface Filters {
  text: string;
  colors: string[];
  colorMode: "alguno" | "dentro" | "exacto";
  colorBy: "identity" | "color";
  types: TypeKey[];
  supertypes: SupertypeKey[];
  subtype: string;
  keyword: string;
  role: string | null;
  cmc: Range;
  power: Range;
  toughness: Range;
  price: Range;
  rarities: RarityKey[];
  sets: string[];
  conditions: string[];
  languages: string[];
  artist: string;
  finish: "" | "foil" | "nonfoil";
  quantityMin: number | null;
  addedWithin: number | null;
  use: "" | "libres" | "en-mazos";
  commander: boolean;
  gameChanger: boolean;
}

export const EMPTY_FILTERS: Filters = {
  text: "",
  colors: [],
  colorMode: "alguno",
  colorBy: "identity",
  types: [],
  supertypes: [],
  subtype: "",
  keyword: "",
  role: null,
  cmc: EMPTY_RANGE,
  power: EMPTY_RANGE,
  toughness: EMPTY_RANGE,
  price: EMPTY_RANGE,
  rarities: [],
  sets: [],
  conditions: [],
  languages: [],
  artist: "",
  finish: "",
  quantityMin: null,
  addedWithin: null,
  use: "",
  commander: false,
  gameChanger: false,
};

/** "2" / "0,5" → número; vacío o no válido → undefined. */
export function numberOf(v: string): number | undefined {
  const t = v.trim().replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const rangeSet = (r: Range) => numberOf(r.min) !== undefined || numberOf(r.max) !== undefined;

/** Desde hace N días, a medianoche (UTC): no cambia en todo el día (sirve de clave de caché). */
export function sinceDays(days: number, now = Date.now()): string {
  const d = new Date(now - days * 86_400_000);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Los filtros para `POST /api/collection/view` (sin los vacíos). */
export function collectionQuery(f: Filters, now = Date.now()): CollectionFilters {
  const q: CollectionFilters = {};
  const put = <K extends keyof CollectionFilters>(k: K, v: CollectionFilters[K] | undefined) => {
    if (v !== undefined) q[k] = v;
  };
  if (f.text.trim()) q.text = f.text.trim();
  if (f.colors.length > 0) {
    q.colors = f.colors as CollectionFilters["colors"];
    q.colorMode = f.colorMode;
    if (f.colorBy === "color") q.colorBy = "color";
  }
  if (f.types.length) q.types = f.types;
  if (f.supertypes.length) q.supertypes = f.supertypes;
  if (f.subtype.trim()) q.subtype = f.subtype.trim();
  if (f.keyword.trim()) q.keyword = f.keyword.trim();
  if (f.role) q.role = f.role as CollectionFilters["role"];
  put("cmcMin", numberOf(f.cmc.min));
  put("cmcMax", numberOf(f.cmc.max));
  put("powerMin", numberOf(f.power.min));
  put("powerMax", numberOf(f.power.max));
  put("toughnessMin", numberOf(f.toughness.min));
  put("toughnessMax", numberOf(f.toughness.max));
  put("priceMin", numberOf(f.price.min));
  put("priceMax", numberOf(f.price.max));
  if (f.rarities.length) q.rarities = f.rarities;
  if (f.sets.length) q.sets = f.sets;
  if (f.conditions.length) q.conditions = f.conditions;
  // La API admite un idioma: con varios, el primero (la hoja solo deja elegir uno).
  if (f.languages[0]) q.language = f.languages[0];
  if (f.artist.trim()) q.artist = f.artist.trim();
  if (f.finish) q.finish = f.finish;
  if (f.quantityMin !== null) q.quantityMin = f.quantityMin;
  if (f.addedWithin !== null) q.addedSince = sinceDays(f.addedWithin, now);
  if (f.use) q.use = f.use;
  if (f.commander) q.commander = true;
  if (f.gameChanger) q.gameChanger = true;
  return q;
}

/** Los filtros para `GET /api/cards` (los que tiene el buscador). */
export function catalogParams(f: Filters, text: string): URLSearchParams {
  const p = new URLSearchParams();
  if (text) p.set("q", text);
  const colors = f.colors.filter((c) => c !== "C");
  if (f.colors.includes("C") && colors.length === 0) p.set("colors", "C");
  else if (colors.length) {
    p.set("colors", colors.join(""));
    p.set("mode", { alguno: "includes", dentro: "within", exacto: "exact" }[f.colorMode]);
  }
  if (f.colors.length && f.colorBy === "color") p.set("by", "color");
  const type = TYPE_OPTIONS.find((t) => t.key === f.types[0]);
  if (type) p.set("type", type.catalog);
  if (f.supertypes.length) p.set("super", f.supertypes.join(",").toLowerCase());
  if (f.text.trim()) p.set("o", f.text.trim());
  if (f.subtype.trim()) p.set("sub", f.subtype.trim());
  if (f.keyword.trim()) p.set("kw", f.keyword.trim());
  const int = (k: string, v: string) => {
    const n = numberOf(v);
    if (n !== undefined) p.set(k, String(Math.round(n)));
  };
  int("cmin", f.cmc.min);
  int("cmax", f.cmc.max);
  int("powmin", f.power.min);
  int("powmax", f.power.max);
  int("toumin", f.toughness.min);
  int("toumax", f.toughness.max);
  const min = numberOf(f.price.min);
  const max = numberOf(f.price.max);
  if (min !== undefined) p.set("min", String(min));
  if (max !== undefined) p.set("max", String(max));
  if (f.rarities.length) p.set("rarity", f.rarities.join(","));
  if (f.sets[0]) p.set("set", f.sets[0].toLowerCase());
  if (f.artist.trim()) p.set("artist", f.artist.trim());
  if (f.commander) p.set("commander", "1");
  if (f.gameChanger) p.set("gc", "1");
  return p;
}

/**
 * Los filtros puestos, uno por grupo, con su etiqueta corta y cómo quitarlo (las fichas que se
 * ven bajo el buscador).
 */
export function activeFilters(
  f: Filters,
): { key: string; label: string; clear: Partial<Filters> }[] {
  const out: { key: string; label: string; clear: Partial<Filters> }[] = [];
  const add = (key: string, on: boolean, label: string, clear: Partial<Filters>) => {
    if (on) out.push({ key, label, clear });
  };
  const range = (r: Range, unit = "") => `${r.min.trim() || "…"}–${r.max.trim() || "…"}${unit}`;
  const labels = <K extends string>(keys: K[], opts: readonly { key: K; label: string }[]) =>
    keys.map((k) => opts.find((o) => o.key === k)?.label ?? k).join(", ");
  add("colors", f.colors.length > 0, f.colors.join(""), { colors: [] });
  add("types", f.types.length > 0, labels(f.types, TYPE_OPTIONS), { types: [] });
  add("supertypes", f.supertypes.length > 0, labels(f.supertypes, SUPERTYPE_OPTIONS), {
    supertypes: [],
  });
  add("text", f.text.trim() !== "", `«${f.text.trim()}»`, { text: "" });
  add("subtype", f.subtype.trim() !== "", f.subtype.trim(), { subtype: "" });
  add("keyword", f.keyword.trim() !== "", f.keyword.trim(), { keyword: "" });
  add("role", f.role !== null, ROLE_OPTIONS.find((r) => r.key === f.role)?.label ?? "", {
    role: null,
  });
  add("cmc", rangeSet(f.cmc), `Maná ${range(f.cmc)}`, { cmc: EMPTY_RANGE });
  add("power", rangeSet(f.power), `Fue. ${range(f.power)}`, { power: EMPTY_RANGE });
  add("toughness", rangeSet(f.toughness), `Res. ${range(f.toughness)}`, {
    toughness: EMPTY_RANGE,
  });
  add("price", rangeSet(f.price), range(f.price, " €"), { price: EMPTY_RANGE });
  add("rarities", f.rarities.length > 0, labels(f.rarities, RARITY_OPTIONS), { rarities: [] });
  add("sets", f.sets.length > 0, f.sets.join(", "), { sets: [] });
  add("conditions", f.conditions.length > 0, f.conditions.length + " estados", {
    conditions: [],
  });
  add("languages", f.languages.length > 0, f.languages.join(", ").toUpperCase(), {
    languages: [],
  });
  add("artist", f.artist.trim() !== "", f.artist.trim(), { artist: "" });
  add("finish", f.finish !== "", f.finish === "foil" ? "★ Foil" : "No foil", { finish: "" });
  add("quantity", f.quantityMin !== null, `${f.quantityMin}+ copias`, { quantityMin: null });
  add(
    "added",
    f.addedWithin !== null,
    `Añadidas: ${ADDED_OPTIONS.find((a) => a.days === f.addedWithin)?.label ?? ""}`,
    { addedWithin: null },
  );
  add("use", f.use !== "", f.use === "libres" ? "Libres" : "En mazos", { use: "" });
  add("commander", f.commander, "Comandante", { commander: false });
  add("gameChanger", f.gameChanger, "Game changers", { gameChanger: false });
  return out;
}
