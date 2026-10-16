import type { CatalogQuery } from "../cards/catalog-search";
import type { CardLocalization, KeywordAlias, LocalizedText } from "../cards/localized";
import type { NameEntry } from "../cards/name-match";
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
  /** Buscador de cartas con filtros (nombre/tipo/texto, colores, tipo, comandante…), paginado. */
  searchCatalog(
    query: CatalogQuery,
    offset: number,
    limit: number,
  ): Promise<{ cards: Card[]; total: number }>;
  findPrintingsByIds(scryfallIds: readonly string[]): Promise<Printing[]>;
  /** Todas las impresiones de una carta, de la más nueva a la más vieja. */
  findPrintingsOf(oracleId: string): Promise<Printing[]>;
  findPrintingsBySetNumbers(
    pairs: readonly { setCode: string; collectorNumber: string }[],
  ): Promise<Printing[]>;
  /** Precio más barato (EUR) entre las impresiones de cada carta; las que no tienen precio no salen. */
  findMinPrices(oracleIds: readonly string[]): Promise<Map<string, number>>;
  /** De estas cartas, las que son tierras básicas. */
  findBasicLandIds(oracleIds: readonly string[]): Promise<Set<string>>;
  counts(): Promise<{ cards: number; printings: number }>;
  /** El nombre de cada cara de cada carta jugable, para reconocerlas con la cámara. */
  nameEntries(): Promise<NameEntry[]>;
  /**
   * Lo impreso de estas cartas en otros idiomas (nombre tal cual; tipo y texto ya pasados por
   * `searchKey`), para buscar en cualquier idioma. Las que no tienen, no salen.
   */
  findLocalizations(oracleIds: readonly string[]): Promise<Map<string, LocalizedText[]>>;
  /** Cómo se dice cada habilidad clave en otros idiomas. */
  keywordAliases(): Promise<KeywordAlias[]>;
}

/** Escritura de los textos en otros idiomas (sync semanal). */
export interface LocalizationWriter {
  /** Reemplaza todos los textos en otros idiomas y los alias de habilidades. */
  replaceLocalizations(
    rows: readonly CardLocalization[],
    aliases: readonly KeywordAlias[],
    sync: { syncedAt: Date; bulkUpdatedAt: string },
  ): Promise<void>;
  /** La última descarga (null si nunca). */
  localizationSync(): Promise<{ syncedAt: Date; bulkUpdatedAt: string; rows: number } | null>;
}

/** Escritura del catálogo, usada solo por la sincronización con Scryfall. */
export interface CardCatalogWriter {
  clearCatalog(): Promise<void>;
  insertCards(cards: readonly Card[]): Promise<void>;
  insertPrintings(printings: readonly Printing[]): Promise<void>;
}
