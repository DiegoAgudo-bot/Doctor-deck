/**
 * Idiomas de la web. El español vive en la raíz (`/cards`) y el inglés con prefijo
 * (`/en/cards`): las URL de siempre no cambian y cada idioma tiene las suyas para los buscadores.
 * Por dentro, todas las páginas cuelgan de `app/[lang]` (el proxy reescribe `/cards` → `/es/cards`).
 */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const isLocale = (s: string | null | undefined): s is Locale => s === "es" || s === "en";

/** Cookie con el idioma elegido a mano (el proxy lleva ahí a quien entra sin prefijo). */
export const LOCALE_COOKIE = "dd-lang";

/** Formato de números y fechas: euros con coma en español y con punto en inglés. */
export const intlLocale = (l: Locale) => (l === "en" ? "en-GB" : "es-ES");

/** `/cards` en ese idioma: igual en español, `/en/cards` en inglés (`/` → `/en`). */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE || !path.startsWith("/") || path.startsWith("//")) return path;
  if (isUnlocalized(path) || /^\/(en|es)(?=$|[/?#])/.test(path)) return path;
  return path === "/" ? "/en" : `/en${path}`;
}

/** Separa el idioma de una ruta: `/en/cards?x=1` → `{ locale: "en", path: "/cards?x=1" }`. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/(en|es)(?=$|[/?#])(.*)$/.exec(pathname);
  if (!m) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
  const rest = m[2] ?? "";
  return { locale: m[1] as Locale, path: rest === "" || rest.startsWith("?") ? `/${rest}` : rest };
}

/** Lo que no es una página (API, imágenes, ficheros estáticos): nunca lleva idioma. */
export function isUnlocalized(path: string): boolean {
  return /^\/(api|img|_next|icons|symbols|\.well-known)(\/|$)|^\/[^/]+\.[a-z0-9]+$/i.test(path);
}

/** Texto en el idioma pedido: `pick("en", "Colección", "Collection")`. */
export const pick = (locale: Locale, es: string, en: string) => (locale === "en" ? en : es);
