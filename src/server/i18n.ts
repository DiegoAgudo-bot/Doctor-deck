import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale, localePath, pick, type Locale } from "@/domain/i18n/locale";

/**
 * Idioma de la página (segmento `[lang]`), de sus `params`; se pasa explícito a lo que lo necesita
 * (también vale en `generateMetadata`, donde `next/root-params` no está disponible).
 */
export async function paramLocale(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** `t("Colección", "Collection")` en ese idioma. */
export const tFor =
  (locale: Locale) =>
  (es: string, en: string): string =>
    pick(locale, es, en);

/**
 * Canónica de la página en su idioma y sus versiones en los demás (hreflang). `path` sin idioma.
 * El español es también la versión por defecto (`x-default`).
 */
export function localeAlternates(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: { es: path, en: localePath("en", path), "x-default": path },
  };
}

type Pair = readonly [es: string, en: string];

/**
 * `generateMetadata` de una página con título (y descripción) en los dos idiomas. Con `path`, la
 * página es pública: canónica en su idioma y sus versiones (hreflang). Sin `path`, no se indexa.
 */
export function pageMetadata(o: { title: Pair; description?: Pair; path?: string }) {
  return async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
    const locale = await paramLocale(params);
    const t = (p: Pair) => pick(locale, p[0], p[1]);
    return {
      title: `${t(o.title)} · Doctor Deck`,
      ...(o.description ? { description: t(o.description) } : {}),
      ...(o.path ? { alternates: localeAlternates(locale, o.path) } : { robots: { index: false } }),
    };
  };
}
