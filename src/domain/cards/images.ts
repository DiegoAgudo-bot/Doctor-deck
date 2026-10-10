/**
 * Imágenes de cartas servidas desde nuestro servidor (`/img/…`), que las guarda en disco la primera
 * vez que alguien las pide a cards.scryfall.io. Así, si Scryfall no responde (p. ej. por los
 * bloqueos de LaLiga en España), las ya vistas siguen saliendo.
 */
export const SCRYFALL_IMAGE_ORIGIN = "https://cards.scryfall.io";
export const LOCAL_IMAGE_PREFIX = "/img/";

/** Ruta de imagen de Scryfall válida: "normal/front/8/e/<uuid>.jpg" (y variantes de tamaño/cara). */
const IMAGE_PATH =
  /^(?:small|normal|large|png|art_crop|border_crop)\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/[0-9a-f-]{36}\.(?:jpg|png)$/;

/** La ruta de una URL de imagen de Scryfall, o null si no lo es (o no tiene la forma esperada). */
export function scryfallImagePath(url: string): string | null {
  if (!url.startsWith(`${SCRYFALL_IMAGE_ORIGIN}/`)) return null;
  const path = url.slice(SCRYFALL_IMAGE_ORIGIN.length + 1).split("?")[0] ?? "";
  return isScryfallImagePath(path) ? path : null;
}

/** ¿Es una ruta que podemos pedir a Scryfall? (evita usar el proxy para cualquier otra cosa). */
export const isScryfallImagePath = (path: string) => IMAGE_PATH.test(path);

/** URL que debe usar el navegador: la nuestra si es una imagen de Scryfall; si no, la misma. */
export function localImageUrl(url: string | null): string | null {
  if (url === null) return null;
  const path = scryfallImagePath(url);
  return path ? `${LOCAL_IMAGE_PREFIX}${path}` : url;
}
