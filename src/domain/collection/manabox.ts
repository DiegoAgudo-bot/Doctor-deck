import { normalizeCondition, type Condition } from "../cards/conditions";
import { normalizeLanguage, type Language } from "../cards/languages";
import { csvToRecords } from "./csv";

/** Fila del export de ManaBox, ya tipada. */
export interface CollectionRow {
  /** Número de línea en el CSV (la cabecera es la 1). */
  line: number;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
  scryfallId: string | null;
  quantity: number;
  foil: boolean;
  /** Código de Scryfall ("en", "es", "ja"…); null si no viene o no se reconoce. */
  language: Language | null;
  /** Estado ("near_mint", "lightly_played"…); null si no viene o no se reconoce. */
  condition: Condition | null;
  /** Día en que se añadió a la colección ("YYYY-MM-DD", columna `Added`); null si no viene. */
  addedOn: string | null;
  /** Precio de compra por copia en EUR (`Purchase price`); null si no viene, es 0 u otra moneda. */
  purchaseEur: number | null;
  raw: Record<string, string>;
}

export interface CollectionRowError {
  line: number;
  reason: string;
  raw: Record<string, string>;
}

export interface ParsedCollection {
  rows: CollectionRow[];
  errors: CollectionRowError[];
}

export class ManaboxFormatError extends Error {}

/**
 * Nombres de columna que se aceptan para cada dato (sin distinguir mayúsculas). Además del CSV de
 * ManaBox, los de las apps y webs de colección más usadas: Moxfield ("Count", "Edition" con el
 * código), Archidekt ("Edition Code", "Finish"), Deckbox ("Card Number", "Edition" con el nombre),
 * Dragon Shield ("Card Name", "Set Code", "Printing"), TCGplayer ("Set Code", "Printing")…
 */
const ALIASES = {
  name: ["name", "card name", "card", "cardname"],
  quantity: ["quantity", "count", "qty", "amount", "quantityx"],
  setCode: ["set code", "edition code", "setcode", "set_code", "edition", "set"],
  collectorNumber: ["collector number", "card number", "collector_number", "number", "cn"],
  scryfallId: ["scryfall id", "scryfall_id", "scryfallid"],
  foil: ["foil", "printing", "finish", "foiling"],
  language: ["language", "lang"],
  condition: ["condition"],
  added: ["added", "date added", "added at", "added_at", "added date"],
  purchasePrice: ["purchase price", "purchase_price", "price bought", "bought price"],
  purchaseCurrency: ["purchase price currency", "purchase currency", "currency"],
} as const;
type Field = keyof typeof ALIASES;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un código de edición (`cmm`, `PLST`, `30a`…), no su nombre ("Commander Masters"). */
const SET_CODE_RE = /^[a-z0-9]{2,6}$/i;

const blankToNull = (v: string | undefined) => {
  const t = v?.trim() ?? "";
  return t === "" ? null : t;
};

/** "foil", "Foil", "etched", "true", "yes" → foil; "normal", "nonfoil", "false", "" → no. */
const isFoil = (v: string) => {
  const t = v.trim().toLowerCase();
  return t !== "" && !["normal", "nonfoil", "non-foil", "false", "no", "0", "regular"].includes(t);
};

/** "2025-11-14T14:07:18.709Z" o "2025-11-14 10:00" → "2025-11-14"; otros formatos, null. */
const dayOf = (v: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v?.trim() ?? "");
  return m && !Number.isNaN(Date.parse(`${m[1]}-${m[2]}-${m[3]}`))
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null;
};

/** "2.84" o "2,84" en EUR (o sin moneda) → 2.84; vacío, 0, inválido u otra moneda → null. */
const eurOf = (price: string | undefined, currency: string | undefined) => {
  const c = currency?.trim().toUpperCase() ?? "";
  if (c !== "" && c !== "EUR" && c !== "€") return null;
  const n = Number(price?.trim().replace(/\s*€$/, "").replace(",", ".") ?? "");
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** Para cada dato, la columna del CSV que lo trae (la primera que coincida). */
function columns(header: readonly string[]): Partial<Record<Field, string>> {
  const byLower = new Map(header.map((h) => [h.trim().toLowerCase(), h] as const));
  const out: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    const found = ALIASES[field].map((a) => byLower.get(a)).find((h) => h !== undefined);
    if (found) out[field] = found;
  }
  return out;
}

/** Algunas apps ponen `sep=,` en la primera línea (para Excel). */
const withoutSepLine = (text: string) => text.replace(/^\uFEFF?sep=.\r?\n/i, "");

/** ¿Tiene cabecera de colección? (nombre y cantidad, con cualquiera de sus nombres). */
export function looksLikeCollectionCsv(text: string): boolean {
  const first = withoutSepLine(text.trimStart()).split(/\r?\n/, 1)[0] ?? "";
  const header = first.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const cols = columns(header);
  return cols.name !== undefined && cols.quantity !== undefined;
}

/**
 * Parsea el CSV de una colección: el de ManaBox o el de otras apps (ver `ALIASES`). Las filas
 * inválidas se devuelven en `errors`.
 */
export function parseManaboxCsv(text: string): ParsedCollection {
  const { header, records } = csvToRecords(withoutSepLine(text));
  const col = columns(header);
  const missing = [col.name ? null : "Name", col.quantity ? null : "Quantity"].filter(Boolean);
  if (missing.length > 0) {
    throw new ManaboxFormatError(
      `El CSV no tiene el formato de colección que espero: faltan las columnas ${missing.join(", ")}`,
    );
  }
  const get = (raw: Record<string, string>, field: Field) => {
    const h = col[field];
    return h === undefined ? undefined : raw[h];
  };

  const rows: CollectionRow[] = [];
  const errors: CollectionRowError[] = [];

  records.forEach((raw, idx) => {
    const line = idx + 2;
    const name = blankToNull(get(raw, "name"));
    const quantity = Number((get(raw, "quantity") ?? "").trim().replace(/x$/i, ""));
    if (!name) {
      errors.push({ line, reason: "Fila sin nombre de carta", raw });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push({ line, reason: `Cantidad inválida: "${get(raw, "quantity") ?? ""}"`, raw });
      return;
    }
    const scryfallId = blankToNull(get(raw, "scryfallId"));
    const setCode = blankToNull(get(raw, "setCode"));
    rows.push({
      line,
      name,
      setCode: setCode && SET_CODE_RE.test(setCode) ? setCode.toLowerCase() : null,
      collectorNumber: blankToNull(get(raw, "collectorNumber")),
      scryfallId: scryfallId && UUID_RE.test(scryfallId) ? scryfallId.toLowerCase() : null,
      quantity,
      foil: isFoil(get(raw, "foil") ?? ""),
      language: normalizeLanguage(get(raw, "language")),
      condition: normalizeCondition(get(raw, "condition")),
      addedOn: dayOf(get(raw, "added")),
      purchaseEur: eurOf(get(raw, "purchasePrice"), get(raw, "purchaseCurrency")),
      raw,
    });
  });

  return { rows, errors };
}

/** Una línea de la colección para exportarla con el formato de ManaBox. */
export interface ManaboxExportRow {
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  foil: boolean;
  quantity: number;
  scryfallId: string | null;
  condition: string | null;
  language: string | null;
  /** Precio de referencia por copia (EUR), si se sabe. */
  price: number | null;
  addedAt: Date;
}

export const MANABOX_HEADER = [
  "Name",
  "Set code",
  "Set name",
  "Collector number",
  "Foil",
  "Rarity",
  "Quantity",
  "ManaBox ID",
  "Scryfall ID",
  "Purchase price",
  "Misprint",
  "Altered",
  "Signed",
  "Condition",
  "Language",
  "Proxy",
  "Purchase price currency",
  "Added",
] as const;

const csvField = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * La colección en el mismo CSV que exporta ManaBox (lo vuelven a leer ManaBox, Moxfield y esta
 * misma web). Lo que no guardamos (rareza, ID de ManaBox…) va vacío o con el valor por defecto.
 */
export function toManaboxCsv(rows: readonly ManaboxExportRow[]): string {
  const lines = rows.map((r) =>
    [
      r.name,
      r.setCode?.toUpperCase() ?? "",
      r.setName ?? "",
      r.collectorNumber ?? "",
      r.foil ? "foil" : "normal",
      "",
      String(r.quantity),
      "",
      r.scryfallId ?? "",
      r.price !== null ? r.price.toFixed(2) : "",
      "false",
      "false",
      "false",
      r.condition ?? "near_mint",
      r.language ?? "en",
      "false",
      "EUR",
      r.addedAt.toISOString(),
    ]
      .map(csvField)
      .join(","),
  );
  return [MANABOX_HEADER.join(","), ...lines].join("\n") + "\n";
}
