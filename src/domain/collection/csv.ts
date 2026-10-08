export class CsvParseError extends Error {}

/**
 * Parser CSV (RFC 4180): comillas dobles, `""` como comilla escapada, saltos de línea
 * dentro de campos entrecomillados y finales `\n` o `\r\n`. Ignora BOM y líneas vacías.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    field = "";
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (field !== "") throw new CsvParseError(`Comilla inesperada en la fila ${rows.length + 1}`);
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += ch;
    }
    i += 1;
  }
  if (inQuotes) throw new CsvParseError("Comillas sin cerrar al final del fichero");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Convierte las filas en objetos usando la primera fila como cabecera. */
export function csvToRecords(text: string): {
  header: string[];
  records: Record<string, string>[];
} {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { header: [], records: [] };
  const records = rows.map((cells) =>
    Object.fromEntries(header.map((h, idx) => [h.trim(), cells[idx] ?? ""])),
  );
  return { header: header.map((h) => h.trim()), records };
}
