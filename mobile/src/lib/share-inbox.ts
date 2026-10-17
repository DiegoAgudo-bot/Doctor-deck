/**
 * Buzón de lo compartido con la app hasta que lo recoge la pantalla de importar. Llega por dos
 * vías (el evento del módulo nativo y `takeShareIntent`, que la app pide al arrancar y al volver
 * a primer plano), así que la misma entrega puede llegar dos veces: lo ya recogido se ignora un
 * rato. Sin dependencias de React Native para poder probarlo.
 */

export interface SharedFile {
  path: string | null;
  fileName: string | null;
}

export type ShareItem =
  | { kind: "content"; text: string | null; files: SharedFile[] | null }
  | { kind: "error"; message: string };

/** Lo que ya se recogió no vuelve a entrar en este tiempo (la otra vía de la misma entrega). */
const REPEAT_MS = 15_000;

let current: ShareItem | null = null;
let taken: { key: string; at: number } | null = null;
const listeners = new Set<() => void>();

const keyOf = (item: ShareItem) => JSON.stringify(item);

/** Deja algo en el buzón si está vacío y no es lo que se acaba de recoger. */
export function putShare(item: ShareItem, now = Date.now()): boolean {
  if (current) return false;
  if (taken && taken.key === keyOf(item) && now - taken.at < REPEAT_MS) return false;
  current = item;
  listeners.forEach((l) => l());
  return true;
}

export const peekShare = (): ShareItem | null => current;

/** Lo recoge (la pantalla de importar, cuando ya lo ha leído). */
export function takeShare(now = Date.now()): ShareItem | null {
  const item = current;
  if (!item) return null;
  current = null;
  taken = { key: keyOf(item), at: now };
  listeners.forEach((l) => l());
  return item;
}

export function subscribeShare(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Solo para los tests. */
export function resetShareInbox() {
  current = null;
  taken = null;
}
