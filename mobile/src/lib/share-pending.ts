import type { ShareItem } from "./share-inbox";

/**
 * Lee `pending.json`, lo que deja la actividad nativa que recibe lo compartido:
 * `{id, text}` (una lista), `{id, path, fileName}` (un fichero copiado) o `{id, error}`.
 * Sin dependencias de React Native para poder probarlo.
 */
export function itemFromPending(raw: string): ShareItem {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "error", message: "lo compartido llegó incompleto" };
  }
  if (typeof data !== "object" || data === null) {
    return { kind: "error", message: "lo compartido llegó incompleto" };
  }
  const d = data as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  const id = str("id");
  if (str("error")) return { kind: "error", message: str("error")! };
  const path = str("path");
  if (path) {
    return { kind: "content", id, text: null, files: [{ path, fileName: str("fileName") }] };
  }
  const text = str("text");
  if (text) return { kind: "content", id, text, files: null };
  return { kind: "error", message: "no llega ni texto ni fichero" };
}
