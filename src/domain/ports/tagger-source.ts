/** Etiquetas de Scryfall Tagger (`otag:`): qué cartas tienen cada una. */
export interface TaggerSource {
  /** oracleIds de las cartas con esa etiqueta (todas las páginas). */
  cardsWithTag(tag: string): Promise<string[]>;
}

/** Guarda las etiquetas sincronizadas (no se borran al vaciar el catálogo). */
export interface CardTagWriter {
  /** Reemplaza las cartas que tienen esa etiqueta y apunta cuándo se sincronizó. */
  replaceTag(tag: string, oracleIds: readonly string[], syncedAt: Date): Promise<void>;
  /** Cuándo se sincronizó cada etiqueta por última vez. */
  tagSyncs(): Promise<Map<string, { syncedAt: Date; cards: number }>>;
}
