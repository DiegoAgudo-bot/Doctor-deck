import type { AverageDeck, CommanderRecommendations } from "../recommendations/types";

export interface RecommendationQuery {
  /** Nombres de los comandantes (1 o 2). */
  commanders: readonly string[];
  /** Slug del tema (p. ej. "counters"), o nada para la página general. */
  theme?: string | undefined;
}

/** Fuente de recomendaciones por comandante (EDHREC). */
export interface RecommendationSource {
  getRecommendations(query: RecommendationQuery): Promise<CommanderRecommendations>;
}

/** Fuente de mazos medios por comandante (EDHREC "average decks"). */
export interface AverageDeckSource {
  getAverageDeck(query: RecommendationQuery): Promise<AverageDeck>;
}
