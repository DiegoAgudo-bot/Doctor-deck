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

const COL = {
  name: "Name",
  setCode: "Set code",
  collectorNumber: "Collector number",
  foil: "Foil",
  quantity: "Quantity",
  scryfallId: "Scryfall ID",
  language: "Language",
  condition: "Condition",
} as const;

const REQUIRED = [COL.name, COL.quantity] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const blankToNull = (v: string | undefined) => {
  const t = v?.trim() ?? "";
  return t === "" ? null : t;
};

/** Parsea el CSV exportado por ManaBox. Las filas inválidas se devuelven en `errors`. */
export function parseManaboxCsv(text: string): ParsedCollection {
  const { header, records } = csvToRecords(text);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new ManaboxFormatError(
      `El CSV no parece un export de ManaBox: faltan las columnas ${missing.join(", ")}`,
    );
  }

  const rows: CollectionRow[] = [];
  const errors: CollectionRowError[] = [];

  records.forEach((raw, idx) => {
    const line = idx + 2;
    const name = blankToNull(raw[COL.name]);
    const quantity = Number(raw[COL.quantity]);
    if (!name) {
      errors.push({ line, reason: "Fila sin nombre de carta", raw });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push({ line, reason: `Cantidad inválida: "${raw[COL.quantity] ?? ""}"`, raw });
      return;
    }
    const scryfallId = blankToNull(raw[COL.scryfallId]);
    const foil = (raw[COL.foil] ?? "").trim().toLowerCase();
    rows.push({
      line,
      name,
      setCode: blankToNull(raw[COL.setCode])?.toLowerCase() ?? null,
      collectorNumber: blankToNull(raw[COL.collectorNumber]),
      scryfallId: scryfallId && UUID_RE.test(scryfallId) ? scryfallId.toLowerCase() : null,
      quantity,
      foil: foil !== "" && foil !== "normal",
      language: normalizeLanguage(raw[COL.language]),
      condition: normalizeCondition(raw[COL.condition]),
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
