export interface PriceHistory {
  /**
   * Guarda el precio del día `date` ("YYYY-MM-DD") de las cartas que alguien tiene en su colección
   * o en un mazo (el de su impresión más barata). Si ya había uno ese día, lo sustituye. Devuelve
   * cuántas cartas se guardaron.
   */
  recordSnapshot(date: string): Promise<number>;
  /** Precios guardados de una carta, del más antiguo al más reciente. */
  history(oracleId: string, since?: string): Promise<{ date: string; eur: number }[]>;
}
