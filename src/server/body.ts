import { AppError } from "@/application/errors";

/**
 * Tamaño máximo del cuerpo de una petición. Next no pone límite en los Route Handlers: sin esto,
 * un POST de varios GB se lee entero a memoria antes de que zod lo rechace.
 */
export const BODY_LIMIT = {
  /** Lo normal: formularios, cambios, comentarios… */
  small: 256_000,
  /** Con la colección del navegador (`[oracleId, copias]`) o un texto compartido grande. */
  large: 8_000_000,
  /** El CSV de la colección. */
  csv: 21_000_000,
} as const;

const tooLarge = () => new AppError("too_large", "Lo que has mandado es demasiado grande.", 413);

/** El cuerpo como texto, cortando en cuanto pasa de `max` bytes (aunque no diga su tamaño). */
export async function readText(request: Request, max: number = BODY_LIMIT.small): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw tooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** El cuerpo como JSON (con el mismo tope). */
export async function readJson(request: Request, max: number = BODY_LIMIT.small): Promise<unknown> {
  const text = await readText(request, max);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("bad_json", "La petición no es JSON válido.", 400);
  }
}
