"use client";

import { RARITIES, SUPERTYPES, type Rarity, type Supertype } from "@/domain/cards/attributes";
import { CONDITION_CODES, CONDITIONS, type Condition } from "@/domain/cards/conditions";
import { LANGUAGES } from "@/domain/cards/languages";
import {
  CARD_TYPES,
  COLLECTION_SORTS,
  type CardType,
  type CollectionFilters,
  type CollectionSort,
  type SortDir,
} from "@/domain/collection/browse";
import { ROLES, type Role } from "@/domain/roles/types";
import type { CollectionViewResponse } from "@/server/dto";
import { roleLabel } from "./deck-views";
import { ChipChoice, ChipSet, FilterGroup, RangeFields, TextFilter } from "./filter-fields";
import { useLocale, useT } from "./i18n";
import { languageLabel } from "@/domain/cards/languages";
import { rarityLabel, supertypeLabel } from "@/domain/i18n/labels";

export const COLORS = ["W", "U", "B", "R", "G", "C"] as const;
export type ColorKey = (typeof COLORS)[number];
export type ColorMode = "alguno" | "dentro" | "exacto";

export const TYPE_LABELS: Record<CardType, string> = {
  Creature: "Criatura",
  Instant: "Instantáneo",
  Sorcery: "Conjuro",
  Artifact: "Artefacto",
  Enchantment: "Encantamiento",
  Planeswalker: "Planeswalker",
  Land: "Tierra",
  Battle: "Batalla",
};

/** Lo que se ve en los filtros de la colección (como los de ManaBox). */
export interface Filters {
  q: string;
  /** Texto de reglas. */
  text: string;
  colors: ColorKey[];
  colorMode: ColorMode;
  /** Los colores miran la identidad (por defecto) o los de la carta. */
  colorBy: "identity" | "color";
  types: CardType[];
  supertypes: Supertype[];
  subtype: string;
  keyword: string;
  role: Role | "";
  cmcMin: number | null;
  cmcMax: number | null;
  powerMin: number | null;
  powerMax: number | null;
  toughnessMin: number | null;
  toughnessMax: number | null;
  rarities: Rarity[];
  sets: string[];
  conditions: Condition[];
  artist: string;
  finish: "" | "foil" | "nonfoil";
  language: string;
  priceMin: number | null;
  priceMax: number | null;
  /** 2 = solo las repetidas. */
  quantityMin: number | null;
  /** Añadidas en los últimos N días. */
  addedWithin: number | null;
  origin: "" | "csv" | "manual";
  use: "" | "libres" | "en-mazos";
  /** Solo las que pueden ser comandante. */
  commander: boolean;
  gameChanger: boolean;
  sort: CollectionSort;
  /** null = la natural del orden. */
  dir: SortDir | null;
}

export const EMPTY: Filters = {
  q: "",
  text: "",
  colors: [],
  colorMode: "alguno",
  colorBy: "identity",
  types: [],
  supertypes: [],
  subtype: "",
  keyword: "",
  role: "",
  cmcMin: null,
  cmcMax: null,
  powerMin: null,
  powerMax: null,
  toughnessMin: null,
  toughnessMax: null,
  rarities: [],
  sets: [],
  conditions: [],
  artist: "",
  finish: "",
  language: "",
  priceMin: null,
  priceMax: null,
  quantityMin: null,
  addedWithin: null,
  origin: "",
  use: "",
  commander: false,
  gameChanger: false,
  sort: "nombre",
  dir: null,
};

export type View = "cuadricula" | "tabla";

/** Lo que se recuerda: todo menos los textos que se escriben (nombre, reglas, artista…). */
export const prefOf = (f: Filters, view: View) => ({
  ...f,
  q: undefined,
  text: undefined,
  subtype: undefined,
  keyword: undefined,
  artist: undefined,
  view,
});

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pick = <T extends string>(all: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? all.filter((x) => v.includes(x)) : [];

/**
 * Lee lo que se recordó (con la cuenta, del servidor): campo a campo, lo que no se entiende se
 * ignora. Entiende también lo de antes (`type` suelto y `foil: true`).
 */
export function parseCollectionPref(
  raw: unknown,
): { filters: Partial<Filters>; view: View } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : undefined);
  const f: Partial<Filters> = {};
  const sort = str("sort");
  if (sort && (COLLECTION_SORTS as readonly string[]).includes(sort)) {
    f.sort = sort as CollectionSort;
  }
  const dir = str("dir");
  if (dir === "asc" || dir === "desc") f.dir = dir;
  if (Array.isArray(r.colors)) f.colors = pick(COLORS, r.colors);
  const mode = str("colorMode");
  if (mode === "alguno" || mode === "dentro" || mode === "exacto") f.colorMode = mode;
  if (r.colorBy === "color" || r.colorBy === "identity") f.colorBy = r.colorBy;
  if (Array.isArray(r.types)) f.types = pick(CARD_TYPES, r.types);
  else if (typeof r.type === "string" && r.type) f.types = pick(CARD_TYPES, [r.type]);
  if (Array.isArray(r.supertypes)) f.supertypes = pick(SUPERTYPES, r.supertypes);
  const role = str("role");
  if (role !== undefined && (role === "" || (ROLES as readonly string[]).includes(role))) {
    f.role = role as Role | "";
  }
  for (const k of [
    "cmcMin",
    "cmcMax",
    "powerMin",
    "powerMax",
    "toughnessMin",
    "toughnessMax",
    "priceMin",
    "priceMax",
    "quantityMin",
    "addedWithin",
  ] as const) {
    if (k in r) f[k] = num(r[k]);
  }
  // Antes: `cmc` exacto (7 = 7 o más).
  const cmc = num(r.cmc);
  if (cmc !== null && !("cmcMin" in r)) {
    f.cmcMin = cmc;
    f.cmcMax = cmc >= 7 ? null : cmc;
  }
  if (Array.isArray(r.rarities)) f.rarities = pick(RARITIES, r.rarities);
  if (Array.isArray(r.sets)) {
    f.sets = r.sets.filter((s): s is string => typeof s === "string").slice(0, 50);
  }
  if (Array.isArray(r.conditions)) f.conditions = pick(CONDITION_CODES, r.conditions);
  const finish = str("finish");
  if (finish === "" || finish === "foil" || finish === "nonfoil") f.finish = finish;
  else if (r.foil === true) f.finish = "foil";
  const origin = str("origin");
  if (origin === "" || origin === "csv" || origin === "manual") f.origin = origin;
  const use = str("use");
  if (use === "" || use === "libres" || use === "en-mazos") f.use = use;
  if (typeof r.commander === "boolean") f.commander = r.commander;
  if (typeof r.gameChanger === "boolean") f.gameChanger = r.gameChanger;
  const language = str("language");
  if (language !== undefined && (language === "" || language in LANGUAGES)) f.language = language;
  return { filters: f, view: r.view === "tabla" ? "tabla" : "cuadricula" };
}

/** Desde hace N días, a medianoche (UTC): no cambia en todo el día (sirve de clave de caché). */
const since = (days: number) => {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Los filtros de la interfaz, en el formato de la API (sin los vacíos). */
export function toQuery(f: Filters): CollectionFilters {
  const q: CollectionFilters = {};
  if (f.q.trim()) q.q = f.q.trim();
  if (f.text.trim()) q.text = f.text.trim();
  if (f.colors.length > 0) {
    q.colors = f.colors;
    q.colorMode = f.colorMode;
    if (f.colorBy === "color") q.colorBy = "color";
  }
  if (f.types.length) q.types = f.types;
  if (f.supertypes.length) q.supertypes = f.supertypes;
  if (f.subtype.trim()) q.subtype = f.subtype.trim();
  if (f.keyword.trim()) q.keyword = f.keyword.trim();
  if (f.role) q.role = f.role;
  if (f.cmcMin !== null) q.cmcMin = f.cmcMin;
  if (f.cmcMax !== null) q.cmcMax = f.cmcMax;
  if (f.powerMin !== null) q.powerMin = f.powerMin;
  if (f.powerMax !== null) q.powerMax = f.powerMax;
  if (f.toughnessMin !== null) q.toughnessMin = f.toughnessMin;
  if (f.toughnessMax !== null) q.toughnessMax = f.toughnessMax;
  if (f.rarities.length) q.rarities = f.rarities;
  if (f.sets.length) q.sets = f.sets;
  if (f.conditions.length) q.conditions = f.conditions;
  if (f.artist.trim()) q.artist = f.artist.trim();
  if (f.finish) q.finish = f.finish;
  if (f.language) q.language = f.language;
  if (f.priceMin !== null) q.priceMin = f.priceMin;
  if (f.priceMax !== null) q.priceMax = f.priceMax;
  if (f.quantityMin !== null) q.quantityMin = f.quantityMin;
  if (f.addedWithin !== null) q.addedSince = since(f.addedWithin);
  if (f.origin) q.origin = f.origin;
  if (f.use) q.use = f.use;
  if (f.commander) q.commander = true;
  if (f.gameChanger) q.gameChanger = true;
  return q;
}

/** Cuántos filtros de los plegados («Más filtros») hay puestos. */
export function moreActiveCount(f: Filters): number {
  return [
    f.text.trim() !== "",
    f.colorBy === "color" && f.colors.length > 0,
    f.types.length > 0,
    f.supertypes.length > 0,
    f.subtype.trim() !== "",
    f.keyword.trim() !== "",
    f.role !== "",
    f.cmcMin !== null || f.cmcMax !== null,
    f.powerMin !== null || f.powerMax !== null,
    f.toughnessMin !== null || f.toughnessMax !== null,
    f.rarities.length > 0,
    f.sets.length > 0,
    f.conditions.length > 0,
    f.artist.trim() !== "",
    f.finish !== "",
    f.language !== "",
    f.priceMin !== null || f.priceMax !== null,
    f.quantityMin !== null,
    f.addedWithin !== null,
    f.origin !== "",
    f.use !== "",
    f.commander,
    f.gameChanger,
  ].filter(Boolean).length;
}

export const anyActive = (f: Filters) =>
  f.q.trim() !== "" || f.colors.length > 0 || moreActiveCount(f) > 0;

const CONDITION_OPTIONS = CONDITION_CODES.map((c) => [c, CONDITIONS[c].short] as const);

/**
 * Los filtros plegados de la colección, por grupos: la carta (texto, tipos, coste, fuerza…) y
 * mis copias (rareza, edición, estado, idioma, precio…).
 */
export function CollectionMoreFilters({
  f,
  set,
  sets,
  copyFilters,
  mine,
}: {
  f: Filters;
  set: (patch: Partial<Filters>) => void;
  sets: NonNullable<CollectionViewResponse["facets"]>["sets"];
  /** Hay datos de cada copia (estado, idioma…): con cuenta o en la colección de otro. */
  copyFilters: boolean;
  /** Mi colección con cuenta: origen y uso en mazos. */
  mine: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const en = locale === "en";
  const TYPE_OPTIONS = CARD_TYPES.map((ty) => [ty, en ? ty : TYPE_LABELS[ty]] as const);
  const SUPERTYPE_OPTIONS = SUPERTYPES.map((s) => [s, supertypeLabel(s, locale)] as const);
  const RARITY_OPTIONS = RARITIES.map((r) => [r, rarityLabel(r, locale)] as const);
  const ADDED_OPTIONS = [
    [1, t("Hoy", "Today")],
    [7, t("7 días", "7 days")],
    [30, t("30 días", "30 days")],
    [90, t("3 meses", "3 months")],
    [365, t("1 año", "1 year")],
  ] as const;
  const unpicked = sets.filter((s) => !f.sets.includes(s.code));
  return (
    <div className="filtergrid">
      <FilterGroup label={t("Texto de reglas", "Rules text")}>
        <TextFilter
          label={t("Texto de reglas", "Rules text")}
          placeholder={t("roba una carta, draw a card…", "draw a card, roba una carta…")}
          value={f.text}
          onChange={(text) => set({ text })}
        />
      </FilterGroup>
      <FilterGroup label={t("Tipo (alguno de)", "Type (any of)")}>
        <ChipSet options={TYPE_OPTIONS} value={f.types} onChange={(types) => set({ types })} />
      </FilterGroup>
      <FilterGroup label={t("Supertipo", "Supertype")}>
        <ChipSet
          options={SUPERTYPE_OPTIONS}
          value={f.supertypes}
          onChange={(supertypes) => set({ supertypes })}
        />
      </FilterGroup>
      <FilterGroup label={t("Subtipo y habilidad", "Subtype and keyword")}>
        <span className="flex gap-2">
          <TextFilter
            label={t("Subtipo", "Subtype")}
            placeholder={t("Elfo, Elf, Equipo…", "Elf, Equipment, Elfo…")}
            value={f.subtype}
            onChange={(subtype) => set({ subtype })}
          />
          <TextFilter
            label={t("Habilidad clave", "Keyword")}
            placeholder={t("Vuela, Flying, Arrolla…", "Flying, Trample, Vuela…")}
            value={f.keyword}
            onChange={(keyword) => set({ keyword })}
          />
        </span>
      </FilterGroup>
      <FilterGroup label={t("Colores", "Colors")}>
        <select
          className="select"
          aria-label={t("Qué colores mirar", "Which colors to look at")}
          value={f.colorBy}
          onChange={(e) => set({ colorBy: e.target.value as Filters["colorBy"] })}
        >
          <option value="identity">
            {t("Identidad de color (lo que admite un mazo)", "Color identity (what a deck allows)")}
          </option>
          <option value="color">{t("Color de la carta", "Card color")}</option>
        </select>
      </FilterGroup>
      <FilterGroup label={t("Rol", "Role")}>
        <select
          className="select"
          aria-label={t("Rol", "Role")}
          value={f.role}
          onChange={(e) => set({ role: e.target.value as Role | "" })}
        >
          <option value="">{t("Todos los roles", "All roles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r, locale)}
            </option>
          ))}
        </select>
      </FilterGroup>
      <FilterGroup label={t("Valor de maná", "Mana value")}>
        <RangeFields
          label={t("Valor de maná", "Mana value")}
          min={f.cmcMin}
          max={f.cmcMax}
          onChange={(cmcMin, cmcMax) => set({ cmcMin, cmcMax })}
        />
      </FilterGroup>
      <FilterGroup label={t("Fuerza", "Power")}>
        <RangeFields
          label={t("Fuerza", "Power")}
          min={f.powerMin}
          max={f.powerMax}
          onChange={(powerMin, powerMax) => set({ powerMin, powerMax })}
        />
      </FilterGroup>
      <FilterGroup label={t("Resistencia", "Toughness")}>
        <RangeFields
          label={t("Resistencia", "Toughness")}
          min={f.toughnessMin}
          max={f.toughnessMax}
          onChange={(toughnessMin, toughnessMax) => set({ toughnessMin, toughnessMax })}
        />
      </FilterGroup>
      <FilterGroup label={t("Rareza", "Rarity")}>
        <ChipSet
          options={RARITY_OPTIONS}
          value={f.rarities}
          onChange={(rarities) => set({ rarities })}
        />
      </FilterGroup>
      <FilterGroup label={t("Edición", "Set")}>
        {f.sets.length > 0 && (
          <div className="chips">
            {f.sets.map((code) => (
              <button
                key={code}
                type="button"
                className="chipbtn is-on"
                title={t("Quitar", "Remove")}
                onClick={() => set({ sets: f.sets.filter((s) => s !== code) })}
              >
                {code} ×
              </button>
            ))}
          </div>
        )}
        <select
          className="select"
          aria-label={t("Añadir una edición", "Add a set")}
          value=""
          disabled={unpicked.length === 0}
          onChange={(e) => e.target.value && set({ sets: [...f.sets, e.target.value] })}
        >
          <option value="">
            {sets.length === 0
              ? t("Sin ediciones conocidas", "No known sets")
              : t("Añadir una edición…", "Add a set…")}
          </option>
          {unpicked.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code}
              {s.name ? ` · ${s.name}` : ""} ({s.copies})
            </option>
          ))}
        </select>
      </FilterGroup>
      <FilterGroup label={t("Artista", "Artist")}>
        <TextFilter
          label={t("Artista", "Artist")}
          placeholder={t("Nombre del artista", "Artist's name")}
          value={f.artist}
          onChange={(artist) => set({ artist })}
        />
      </FilterGroup>
      <FilterGroup label={t("Precio por copia", "Price per copy")}>
        <RangeFields
          label={t("Precio por copia", "Price per copy")}
          unit="€"
          min={f.priceMin}
          max={f.priceMax}
          onChange={(priceMin, priceMax) => set({ priceMin, priceMax })}
        />
      </FilterGroup>
      {copyFilters && (
        <>
          <FilterGroup label={t("Estado", "Condition")}>
            <ChipSet
              options={CONDITION_OPTIONS}
              value={f.conditions}
              onChange={(conditions) => set({ conditions })}
            />
          </FilterGroup>
          <FilterGroup label={t("Acabado e idioma", "Finish and language")}>
            <span className="flex flex-wrap gap-2">
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label={t("Acabado", "Finish")}
                value={f.finish}
                onChange={(e) => set({ finish: e.target.value as Filters["finish"] })}
              >
                <option value="">{t("Foil o normal", "Foil or normal")}</option>
                <option value="foil">{t("Con alguna foil", "With a foil copy")}</option>
                <option value="nonfoil">{t("Con alguna normal", "With a normal copy")}</option>
              </select>
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label={t("Idioma", "Language")}
                value={f.language}
                onChange={(e) => set({ language: e.target.value })}
              >
                <option value="">{t("Cualquier idioma", "Any language")}</option>
                {Object.keys(LANGUAGES).map((code) => (
                  <option key={code} value={code}>
                    {t(`En ${languageLabel(code)}`, `In ${languageLabel(code, "en")}`)}
                  </option>
                ))}
              </select>
            </span>
          </FilterGroup>
          <FilterGroup label={t("Copias", "Copies")}>
            <ChipChoice
              options={[
                [2, t("Repetidas (2+)", "Duplicates (2+)")],
                [4, t("4 o más", "4 or more")],
              ]}
              value={f.quantityMin}
              onChange={(quantityMin) => set({ quantityMin })}
            />
          </FilterGroup>
          <FilterGroup label={t("Añadidas en", "Added in")}>
            <ChipChoice
              options={ADDED_OPTIONS}
              value={f.addedWithin}
              onChange={(addedWithin) => set({ addedWithin })}
            />
          </FilterGroup>
        </>
      )}
      {mine && (
        <>
          <FilterGroup label={t("Origen y uso", "Source and use")}>
            <span className="flex flex-wrap gap-2">
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label={t("Origen", "Source")}
                value={f.origin}
                onChange={(e) => set({ origin: e.target.value as Filters["origin"] })}
              >
                <option value="">{t("CSV y a mano", "CSV and by hand")}</option>
                <option value="csv">{t("Del CSV", "From the CSV")}</option>
                <option value="manual">{t("Añadidas a mano", "Added by hand")}</option>
              </select>
              <select
                className="select"
                style={{ width: "auto" }}
                aria-label={t("Uso en mazos", "Use in decks")}
                value={f.use}
                onChange={(e) => set({ use: e.target.value as Filters["use"] })}
              >
                <option value="">{t("Usadas o no", "Used or not")}</option>
                <option value="libres">{t("Con copias libres", "With free copies")}</option>
                <option value="en-mazos">{t("En algún mazo", "In some deck")}</option>
              </select>
            </span>
          </FilterGroup>
        </>
      )}
      <FilterGroup label={t("Otros", "Other")}>
        <label className="check" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={f.commander}
            onChange={(e) => set({ commander: e.target.checked })}
            style={{ marginTop: 0 }}
          />
          {t("Pueden ser comandante", "Can be commander")}
        </label>
        <label className="check" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={f.gameChanger}
            onChange={(e) => set({ gameChanger: e.target.checked })}
            style={{ marginTop: 0 }}
          />
          Game changers
        </label>
      </FilterGroup>
    </div>
  );
}
