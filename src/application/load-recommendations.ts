import type { CardRepository } from "@/domain/ports/card-repository";
import type {
  RecommendationQuery,
  RecommendationSource,
} from "@/domain/ports/recommendation-source";
import type {
  CommanderRecommendations,
  ResolvedRecommendation,
} from "@/domain/recommendations/types";
import { loadIndexFor } from "./card-index-loader";

export type { ResolvedRecommendation };

export interface ResolvedRecommendations extends Omit<CommanderRecommendations, "cards"> {
  cards: ResolvedRecommendation[];
  /** Nombres de EDHREC que no se han encontrado en el catálogo de Scryfall. */
  unresolved: string[];
}

/** Pide recomendaciones a la fuente y las normaliza a cartas del catálogo (oracleId). */
export async function loadRecommendations(
  query: RecommendationQuery,
  deps: { source: RecommendationSource; cards: CardRepository },
): Promise<ResolvedRecommendations> {
  const recs = await deps.source.getRecommendations(query);
  const index = await loadIndexFor(
    recs.cards.map((r) => ({ name: r.name, setCode: null, collectorNumber: null })),
    deps.cards,
  );
  const cards: ResolvedRecommendation[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  for (const rec of recs.cards) {
    const card = index.cardByName(rec.name);
    if (!card) unresolved.push(rec.name);
    else if (!seen.has(card.oracleId)) {
      seen.add(card.oracleId);
      cards.push({ ...rec, card });
    }
  }
  return { ...recs, cards, unresolved };
}
