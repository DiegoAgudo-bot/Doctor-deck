import type { Card } from "../cards/types";

/** Recomendación de una carta para un comandante (y tema), según una fuente externa (EDHREC). */
export interface CardRecommendation {
  /** Nombre tal como lo da la fuente; se resuelve a oracleId con el CardIndex. */
  name: string;
  /**
   * Sinergia como fracción: +0.12 = "+12 % synergy" (cuánto más se juega con este comandante que en
   * mazos de los mismos colores). null si la fuente no la da.
   */
  synergy: number | null;
  /** Fracción de mazos del comandante que la incluyen (0..1). null si no se puede calcular. */
  inclusion: number | null;
  /** Nº de mazos que la incluyen. */
  numDecks: number | null;
  /** Nº de mazos que podrían incluirla (los del comandante, filtrados por identidad de color). */
  potentialDecks: number | null;
  /** Listas de la fuente donde aparece (p. ej. "highsynergycards", "creatures"). */
  categories: string[];
}

export interface ThemeLink {
  slug: string;
  name: string;
  /** Nº de mazos con ese tema, si la fuente lo da. */
  count: number | null;
}

export interface CommanderRecommendations {
  /** Identificador de la página en la fuente (slug de EDHREC). */
  commanderSlug: string;
  theme: string | null;
  /** Nº de mazos de este comandante (y tema) que conoce la fuente. */
  totalDecks: number | null;
  themes: ThemeLink[];
  cards: CardRecommendation[];
  fetchedAt: Date;
  /** true si la fuente falló y se devuelve una copia de caché caducada. */
  stale: boolean;
  /** Motivo legible cuando `stale` es true (para avisar al usuario). */
  warning: string | null;
}

/** Recomendación ya resuelta a una carta del catálogo. */
export interface ResolvedRecommendation extends CardRecommendation {
  card: Card;
}
