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
  /** En la lista de "game changers" de los brackets de Commander (Scryfall `game_changer`). */
  gameChanger: boolean;
}

/** Impresión concreta de una carta. */
export interface Printing {
  scryfallId: string;
  oracleId: string;
  setCode: string;
  collectorNumber: string;
  lang: string;
  imageUrl: string | null;
  /** Precio de referencia en EUR (Cardmarket vía Scryfall); null si no hay. */
  priceEur?: number | null;
  /** Lo mismo en foil. */
  priceEurFoil?: number | null;
  /** Nombre de la edición ("Commander 2021") y fecha de salida ("2021-04-23"). */
  setName?: string | null;
  releasedAt?: string | null;
}

/** Precio de una copia de esa impresión: foil o normal (si falta uno, el otro). */
export const printingPrice = (p: Printing, foil: boolean): number | null =>
  (foil ? (p.priceEurFoil ?? p.priceEur) : (p.priceEur ?? p.priceEurFoil)) ?? null;
