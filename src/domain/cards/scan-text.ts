import type { Language } from "./languages";

/** Lo que interesa del texto que lee la cámara en una carta. */
export interface ScanReading {
  /** Líneas candidatas a ser el nombre (las de arriba primero). */
  nameLines: string[];
  /** Código de edición impreso abajo a la izquierda ("MKM"), en minúsculas. */
  setCode: string | null;
  /** Número de coleccionista ("123", "45a"), sin ceros a la izquierda. */
  collectorNumber: string | null;
  /** Idioma impreso junto a la edición ("MKM • ES" → "es"). */
  language: Language | null;
}

/** Códigos de idioma que se imprimen en la carta → código de Scryfall. */
const PRINTED_LANGUAGES: Record<string, Language> = {
  EN: "en",
  ES: "es",
  SP: "es",
  FR: "fr",
  DE: "de",
  IT: "it",
  PT: "pt",
  JP: "ja",
  JA: "ja",
  KR: "ko",
  KO: "ko",
  RU: "ru",
  CS: "zhs",
  CT: "zht",
  ZHS: "zhs",
  ZHT: "zht",
};

const RARITY = "[CURMLSTPB]";
/** "123/280 R", "123/280", "R 123/280" (las de 2015–2022). */
const NUMBER_OF_TOTAL = new RegExp(
  `^(?:${RARITY}\\s+)?([0-9OIlSB]{1,4}[a-z]?)\\s*/\\s*([0-9OIlSB]{2,4})(?:\\s+${RARITY})?$`,
);
/** "0123 R", "R 0123", "0123" (desde 2023; el número va con ceros a la izquierda). */
const PADDED_NUMBER = new RegExp(
  `^(?:(${RARITY})\\s+)?([0-9OIlSB]{3,4}[a-z]?)(?:\\s+(${RARITY}))?$`,
);
/**
 * "MKM • ES", "MKM · EN", "MKM * EN", "MKM-EN", "MKM EN" (el punto lo lee como sea), al principio
 * de la línea y en mayúsculas; detrás puede ir el ilustrador ("M19 • EN ✎ Jim Nelson").
 */
const SET_AND_LANGUAGE =
  /^([A-Z0-9]{3,5})(?:\s*[•·*.\-+:,]\s*|\s+)(EN|ES|SP|FR|DE|IT|PT|JP|JA|KR|KO|RU|CS|CT|ZHS|ZHT)\b/;

/** El OCR confunde letras y números en el número de coleccionista. */
const digits = (s: string) =>
  s.replace(/[O]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5").replace(/B/g, "8");

const trimZeros = (n: string) => n.replace(/^0+(?=\d)/, "");

/** ¿Parece un nombre? (letras de verdad, no el número, el copyright ni el ilustrador). */
function looksLikeName(line: string): boolean {
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return false;
  if (/^(illus\.?|ilus\.?|™|©)/i.test(line) || /wizards of the coast/i.test(line)) return false;
  return letters.length / line.replace(/\s/g, "").length >= 0.6;
}

/**
 * Saca de las líneas que lee la cámara (de arriba abajo) las candidatas a nombre, el número de
 * coleccionista, la edición y el idioma. No mira posiciones: los patrones del número y de la
 * edición son lo bastante raros como para no confundirse con el texto de reglas; la fuerza y
 * resistencia ("3/3") no pasa porque se exige un total de dos cifras o más mayor que el número.
 */
export function readCardText(lines: readonly string[]): ScanReading {
  const clean = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
  let setCode: string | null = null;
  let language: Language | null = null;
  let collectorNumber: string | null = null;

  for (const line of clean) {
    const setMatch = SET_AND_LANGUAGE.exec(line);
    if (setMatch && !setCode) {
      setCode = setMatch[1]!.toLowerCase();
      language = PRINTED_LANGUAGES[setMatch[2]!] ?? null;
    }
    if (collectorNumber) continue;
    const ofTotal = NUMBER_OF_TOTAL.exec(line);
    if (ofTotal) {
      const n = Number(digits(ofTotal[1]!).replace(/[a-z]$/, ""));
      const total = Number(digits(ofTotal[2]!));
      // "3/3" es fuerza/resistencia; "123/280" es número de coleccionista.
      if (total >= 20 && n > 0 && n <= total * 1.6) {
        collectorNumber = trimZeros(digits(ofTotal[1]!));
        continue;
      }
    }
    const padded = PADDED_NUMBER.exec(line);
    // Sin total, solo si lleva la rareza al lado o ceros a la izquierda (no un número suelto).
    if (padded && (padded[1] || padded[3] || /^0/.test(digits(padded[2]!)))) {
      collectorNumber = trimZeros(digits(padded[2]!));
    }
  }

  const nameLines = clean.filter(looksLikeName).slice(0, 3);
  return { nameLines, setCode, collectorNumber, language };
}

/**
 * Variantes del código de edición con las confusiones típicas del OCR (0↔O, 1↔I), para probarlas
 * contra el catálogo. La primera es la leída tal cual.
 */
export function setCodeVariants(code: string): string[] {
  const swaps: Record<string, string> = { "0": "o", o: "0", "1": "i", i: "1", "5": "s", s: "5" };
  const out = new Set<string>([code]);
  for (let i = 0; i < code.length; i++) {
    const swap = swaps[code[i]!];
    if (swap) out.add(code.slice(0, i) + swap + code.slice(i + 1));
  }
  return [...out].slice(0, 8);
}
