/**
 * Cartas en otros idiomas: nombre, línea de tipo y texto impresos (de Scryfall, `printed_*`).
 * Sirven para buscar escribiendo en cualquier idioma; el análisis sigue siendo por `oracleId`.
 */

/** Lo impreso de una carta en un idioma (código de Scryfall: es, fr, de, it, pt, ja…). */
export interface CardLocalization {
  oracleId: string;
  lang: string;
  name: string;
  typeLine: string | null;
  /** Sin el texto recordatorio (lo que va entre paréntesis). */
  text: string | null;
  /** Fecha de la impresión de la que sale ("YYYY-MM-DD"): a igualdad, gana la más nueva. */
  releasedAt?: string | null;
}

/** Lo que se busca de una carta en otros idiomas (sin el oracleId ni el idioma). */
export type LocalizedText = Pick<CardLocalization, "name" | "typeLine" | "text">;

/** Para comparar: sin tildes ni mayúsculas (sirve igual para alfabetos sin tildes, como el japonés). */
export const searchKey = (s: string): string =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Quita el texto recordatorio: lo que va entre paréntesis (también los de ancho completo). */
export const stripReminder = (text: string): string =>
  text
    .replace(/\([^()]*\)|（[^（）]*）/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/**
 * Con varias impresiones de la misma carta en el mismo idioma, la mejor: la que trae tipo y texto
 * y, a igualdad, la más nueva (las traducciones antiguas a veces usan otros términos).
 */
export function betterLocalization(a: CardLocalization, b: CardLocalization): CardLocalization {
  const score = (l: CardLocalization) => Number(l.typeLine !== null) + Number(l.text !== null);
  if (score(a) !== score(b)) return score(a) > score(b) ? a : b;
  return (b.releasedAt ?? "") > (a.releasedAt ?? "") ? b : a;
}

/** Partes de la primera línea de un texto: "Voar, vigilância" → ["Voar", "vigilância"]. */
export function keywordLineParts(text: string): string[] {
  const first = stripReminder(text).split("\n")[0] ?? "";
  return first
    .replace(/[.。]\s*$/, "")
    .split(/[,，、;；]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Una carta con sus habilidades clave en inglés y su texto en otros idiomas, para aprender alias. */
export interface KeywordSample {
  keywords: readonly string[];
  englishText: string | null;
  localized: readonly { lang: string; text: string | null }[];
}

/** "Flying" en español es "Vuela", en alemán "Fliegend"…: con cuántas cartas lo dicen. */
export interface KeywordAlias {
  keyword: string;
  lang: string;
  alias: string;
  votes: number;
}

/**
 * Aprende cómo se dice cada habilidad clave en cada idioma con las cartas cuya primera línea es
 * solo una lista de habilidades ("Flying, vigilance" ↔ "Voar, vigilância"): se emparejan por
 * posición si las dos listas tienen las mismas partes. Se quedan las de al menos `minVotes`.
 */
export function deriveKeywordAliases(
  samples: Iterable<KeywordSample>,
  minVotes = 2,
): KeywordAlias[] {
  const votes = new Map<string, KeywordAlias>();
  for (const s of samples) {
    if (!s.englishText || s.keywords.length === 0) continue;
    const english = keywordLineParts(s.englishText);
    const byKey = new Map(s.keywords.map((k) => [k.toLowerCase(), k]));
    const keywords = english.map((p) => byKey.get(p.toLowerCase()));
    if (keywords.length === 0 || keywords.some((k) => k === undefined)) continue;
    for (const l of s.localized) {
      if (!l.text) continue;
      const parts = keywordLineParts(l.text);
      if (parts.length !== keywords.length) continue;
      parts.forEach((alias, i) => {
        const keyword = keywords[i];
        // Más de cuatro palabras: no es el nombre de una habilidad (será una frase de reglas).
        if (!keyword || alias.split(/\s+/).length > 4 || alias.length > 40) return;
        const id = `${keyword}|${l.lang}|${searchKey(alias)}`;
        const v = votes.get(id) ?? { keyword, lang: l.lang, alias, votes: 0 };
        v.votes += 1;
        votes.set(id, v);
      });
    }
  }
  return [...votes.values()].filter((v) => v.votes >= minVotes);
}

/**
 * Lo que se escribe y no sale en las cartas: el infinitivo («volar») cuando en la carta pone
 * «Vuela», etc. Solo lo que el texto impreso no enseña por sí mismo.
 */
export const KEYWORD_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  volar: ["Flying"],
  vuela: ["Flying"],
  vuelo: ["Flying"],
  arrollar: ["Trample"],
  arrolla: ["Trample"],
  "danar primero": ["First strike"],
  "dana primero": ["First strike"],
  "danar dos veces": ["Double strike"],
  "dana dos veces": ["Double strike"],
  "toque mortal": ["Deathtouch"],
  "vinculo vital": ["Lifelink"],
  prisa: ["Haste"],
  vigilancia: ["Vigilance"],
  alcance: ["Reach"],
  destello: ["Flash"],
  antimaleficio: ["Hexproof"],
  amenaza: ["Menace"],
  custodia: ["Ward"],
  defensor: ["Defender"],
  indestructible: ["Indestructible"],
  equipar: ["Equip"],
  voler: ["Flying"],
};

/**
 * Las habilidades clave (en inglés) a las que puede referirse lo escrito en cualquier idioma: los
 * alias aprendidos y los sinónimos que empiezan así o lo contienen.
 */
export function keywordsFor(
  term: string,
  aliases: readonly Pick<KeywordAlias, "keyword" | "alias">[],
): string[] {
  const q = searchKey(term.trim());
  if (!q) return [];
  const out = new Set<string>();
  for (const a of aliases) if (searchKey(a.alias).includes(q)) out.add(a.keyword);
  for (const [word, keywords] of Object.entries(KEYWORD_SYNONYMS)) {
    if (word.startsWith(q) || (q.length >= 4 && q.startsWith(word))) {
      for (const k of keywords) out.add(k);
    }
  }
  return [...out];
}

/** ¿Algún texto (nombre, tipo o reglas) de la carta en otro idioma contiene `q` (ya normalizado)? */
export const localizedMatch = (
  localized: readonly LocalizedText[] | undefined,
  q: string,
  field: (l: LocalizedText) => string | null,
): boolean => (localized ?? []).some((l) => searchKey(field(l) ?? "").includes(q));
