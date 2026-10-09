import type { Card, Printing } from "../cards/types";

/** Lectura del catálogo de cartas (Scryfall volcado en local). */
export interface CardRepository {
  findCardsByOracleIds(oracleIds: readonly string[]): Promise<Card[]>;
  /** Busca por clave de nombre completo o de primera cara (ver `nameKey`). */
  findCardsByNameKeys(keys: readonly string[]): Promise<Card[]>;
  /**
   * Cartas jugables cuyo nombre contiene `query` (sin tildes ni mayúsculas): primero aquellas en
   * las que alguna palabra empieza así y, dentro de cada grupo, las más jugadas en EDHREC.
   */
  searchByName(query: string, limit: number): Promise<Card[]>;
  findPrintingsByIds(scryfallIds: readonly string[]): Promise<Printing[]>;
  findPrintingsBySetNumbers(
    pairs: readonly { setCode: string; collectorNumber: string }[],
  ): Promise<Printing[]>;
  /** Precio más barato (EUR) entre las impresiones de cada carta; las que no tienen precio no salen. */
  findMinPrices(oracleIds: readonly string[]): Promise<Map<string, number>>;
  counts(): Promise<{ cards: number; printings: number }>;
}

/** Escritura del catálogo, usada solo por la sincronización con Scryfall. */
export interface CardCatalogWriter {
  clearCatalog(): Promise<void>;
  insertCards(cards: readonly Card[]): Promise<void>;
  insertPrintings(printings: readonly Printing[]): Promise<void>;
}
