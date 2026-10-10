export interface PriceHistory {
  /**
   * Guarda el precio del día `date` ("YYYY-MM-DD") de las cartas que alguien tiene en su colección
   * o en un mazo (el de su impresión más barata). Si ya había uno ese día, lo sustituye. Devuelve
   * cuántas cartas se guardaron.
   */
  recordSnapshot(date: string): Promise<number>;
  /** Precios guardados de una carta, del más antiguo al más reciente. */
  history(oracleId: string, since?: string): Promise<{ date: string; eur: number }[]>;
  /** Lo mismo para muchas cartas a la vez (las que no tienen histórico no salen). */
  historyMany(
    oracleIds: readonly string[],
    since: string,
  ): Promise<Map<string, { date: string; eur: number }[]>>;
  /** El último día con precios guardados ("YYYY-MM-DD"), o null si no hay ninguno. */
  latestDate(): Promise<string | null>;
  /**
   * Guarda el precio del día (normal y foil) de cada impresión que alguien tiene en su colección.
   * Devuelve cuántas impresiones se guardaron.
   */
  recordPrintingSnapshot(date: string): Promise<number>;
  /** Histórico de esas impresiones (Scryfall ID) desde `since`, del más antiguo al más reciente. */
  printingHistoryMany(
    scryfallIds: readonly string[],
    since: string,
  ): Promise<Map<string, { date: string; eur: number | null; eurFoil: number | null }[]>>;
}
