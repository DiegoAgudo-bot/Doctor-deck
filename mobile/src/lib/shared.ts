/**
 * Lo que llega para importar (elegido como fichero) hasta que lo recoge la pantalla de importar:
 * puede ser un CSV de megas, demasiado para un parámetro de ruta. Lo compartido desde otra app lo
 * lee la propia pantalla.
 */
let pending: { text: string; source: string } | null = null;

export const setPendingImport = (text: string, source: string) => {
  pending = { text, source };
};

export const takePendingImport = () => {
  const p = pending;
  pending = null;
  return p;
};

/** Líneas por tanda como mínimo y tandas como mucho (el servidor deja 30 peticiones/min). */
const MIN_LINES = 150;
const MAX_CHUNKS = 12;

/**
 * Parte lo compartido en tandas para mandarlo poco a poco y enseñar el progreso. Un CSV repite
 * su cabecera (y la línea `sep=,` si la trae) en cada tanda; una lista se parte por líneas.
 * Las listas cortas (y las que traen el comandante o un nombre, que el servidor necesita ver
 * enteras) van de una vez.
 */
export function splitImportText(text: string, csv: boolean): string[] {
  const lines = text.split(/\r?\n/);
  let head: string[] = [];
  let body = lines;
  if (csv) {
    const headerAt = lines.findIndex((l) => l.trim() !== "" && !/^sep=/i.test(l.trim()));
    head = lines.slice(0, headerAt + 1);
    body = lines.slice(headerAt + 1);
  }
  body = body.filter((l) => l.trim() !== "");
  if (!csv || body.length <= MIN_LINES) return [text];
  const size = Math.max(MIN_LINES, Math.ceil(body.length / MAX_CHUNKS));
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += size) {
    chunks.push([...head, ...body.slice(i, i + size)].join("\n"));
  }
  return chunks;
}
