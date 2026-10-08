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
  language: string | null;
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
      language: blankToNull(raw[COL.language]),
      raw,
    });
  });

  return { rows, errors };
}
