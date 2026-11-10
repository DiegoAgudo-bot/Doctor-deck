/**
 * Idioma de la app: el elegido en Ajustes o, si no, el del sistema (español si está en español; si
 * no, inglés). Sin importar nada:
 * lo cargan tal cual los tests de node (`LANG=es_ES.UTF-8` en `npm test`).
 */
export function deviceLocale(tag?: string): "es" | "en" {
  let lang = tag;
  if (lang === undefined) {
    try {
      lang = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      lang = "es";
    }
  }
  return /^es\b/i.test(lang) ? "es" : "en";
}

/** Idioma elegido a mano en Ajustes (lo deja `boot.ts` antes de cargar la app); si no, el del móvil. */
const forced = (globalThis as { __DD_LANG?: string }).__DD_LANG;

export const locale: "es" | "en" = forced === "es" || forced === "en" ? forced : deviceLocale();
export const isEn = locale === "en";
/** "es-ES" | "en-GB", para números y fechas. */
export const intl = isEn ? "en-GB" : "es-ES";

/** `t("Colección", "Collection")`: el texto en el idioma de la app (como `useT` en la web). */
export const t = (es: string, en: string) => (isEn ? en : es);
