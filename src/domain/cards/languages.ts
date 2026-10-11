/**
 * Idiomas de las copias (códigos de Scryfall, los mismos que exporta ManaBox en `Language`).
 * El análisis sigue siendo por carta: el idioma solo se guarda y se enseña.
 */
export const LANGUAGES = {
  en: "inglés",
  es: "español",
  fr: "francés",
  de: "alemán",
  it: "italiano",
  pt: "portugués",
  ja: "japonés",
  ko: "coreano",
  ru: "ruso",
  zhs: "chino simplificado",
  zht: "chino tradicional",
  he: "hebreo",
  la: "latín",
  grc: "griego antiguo",
  ar: "árabe",
  sa: "sánscrito",
  ph: "phyrexiano",
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

/** Nombres que también aparecen en los exports (ManaBox ha usado tanto "en" como "English"). */
const ALIASES: Record<string, Language> = {
  english: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  japanese: "ja",
  korean: "ko",
  russian: "ru",
  "chinese simplified": "zhs",
  "simplified chinese": "zhs",
  "chinese traditional": "zht",
  "traditional chinese": "zht",
  zh: "zhs",
  "zh-cn": "zhs",
  "zh-tw": "zht",
  jp: "ja",
  kr: "ko",
  cn: "zhs",
  tw: "zht",
  hebrew: "he",
  latin: "la",
  "ancient greek": "grc",
  arabic: "ar",
  sanskrit: "sa",
  phyrexian: "ph",
};

/** Código de idioma normalizado, o null si viene vacío o no se reconoce. */
export function normalizeLanguage(value: string | null | undefined): Language | null {
  const v = value?.trim().toLowerCase() ?? "";
  if (v === "") return null;
  if (v in LANGUAGES) return v as Language;
  return ALIASES[v] ?? null;
}

/** "ES", "JA"… para las etiquetas pequeñas; el nombre completo va en el `title`. */
export const languageBadge = (lang: string) => lang.toUpperCase();
export const languageLabel = (lang: string) => LANGUAGES[lang as Language] ?? lang;
