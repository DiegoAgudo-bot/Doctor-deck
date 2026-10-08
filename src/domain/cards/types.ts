export const COLORS = ["W", "U", "B", "R", "G"] as const;
export type Color = (typeof COLORS)[number];

/** Carta "lógica": todas sus impresiones comparten oracleId. */
export interface Card {
  oracleId: string;
  name: string;
  /** Nombre de la primera cara en cartas `A // B`; null si la carta tiene una sola cara. */
  frontFaceName: string | null;
  layout: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
  oracleText: string | null;
  keywords: string[];
  colorIdentity: Color[];
  legalCommander: boolean;
  isBasicLand: boolean;
  edhrecRank: number | null;
  imageUrl: string | null;
}

/** Impresión concreta de una carta. */
export interface Printing {
  scryfallId: string;
  oracleId: string;
  setCode: string;
  collectorNumber: string;
  lang: string;
  imageUrl: string | null;
}
