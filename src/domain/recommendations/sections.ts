import type { ResolvedRecommendation } from "./types";

/**
 * Las listas de la página de un comandante en EDHREC (su `tag`), en el orden en que se enseñan y
 * con su nombre en español. Las que no estén aquí salen al final con su nombre de la fuente.
 */
export const EDHREC_SECTIONS: readonly { key: string; label: string; labelEn: string }[] = [
  { key: "highsynergycards", label: "Alta sinergia", labelEn: "High synergy" },
  { key: "topcards", label: "Las más jugadas", labelEn: "Top cards" },
  { key: "newcards", label: "Novedades", labelEn: "New cards" },
  { key: "gamechangers", label: "Game changers", labelEn: "Game changers" },
  { key: "creatures", label: "Criaturas", labelEn: "Creatures" },
  { key: "instants", label: "Instantáneos", labelEn: "Instants" },
  { key: "sorceries", label: "Conjuros", labelEn: "Sorceries" },
  { key: "utilityartifacts", label: "Artefactos", labelEn: "Artifacts" },
  { key: "manaartifacts", label: "Artefactos de maná", labelEn: "Mana artifacts" },
  { key: "enchantments", label: "Encantamientos", labelEn: "Enchantments" },
  { key: "planeswalkers", label: "Planeswalkers", labelEn: "Planeswalkers" },
  { key: "battles", label: "Batallas", labelEn: "Battles" },
  { key: "utilitylands", label: "Tierras útiles", labelEn: "Utility lands" },
  { key: "lands", label: "Tierras", labelEn: "Lands" },
];

export interface RecommendationSection {
  key: string;
  label: string;
  cards: ResolvedRecommendation[];
}

/**
 * Agrupa las recomendaciones por las listas de la fuente (una carta puede estar en varias: "Las
 * más jugadas" y "Criaturas") y ordena cada lista por inclusión y después por sinergia.
 */
export function recommendationSections(
  recs: readonly ResolvedRecommendation[],
): RecommendationSection[] {
  const byKey = new Map<string, ResolvedRecommendation[]>();
  for (const r of recs) {
    for (const c of new Set(r.categories)) byKey.set(c, [...(byKey.get(c) ?? []), r]);
  }
  const known = new Map(EDHREC_SECTIONS.map((s, i) => [s.key, i]));
  return [...byKey]
    .sort(
      ([a], [b]) =>
        (known.get(a) ?? Number.MAX_SAFE_INTEGER) - (known.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.localeCompare(b),
    )
    .map(([key, cards]) => ({
      key,
      label: EDHREC_SECTIONS.find((s) => s.key === key)?.label ?? key,
      cards: [...cards].sort(
        (a, b) =>
          (b.inclusion ?? -1) - (a.inclusion ?? -1) ||
          (b.synergy ?? -1) - (a.synergy ?? -1) ||
          a.card.name.localeCompare(b.card.name),
      ),
    }));
}

/** Nombre de una lista en el idioma pedido (las que no se conocen, con su clave). */
export function sectionLabel(key: string, locale: "es" | "en"): string {
  const s = EDHREC_SECTIONS.find((x) => x.key === key);
  return s ? (locale === "en" ? s.labelEn : s.label) : key;
}
