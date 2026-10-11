import type { CollectionRow } from "../collection/manabox";
import type { MatchedRow } from "../collection/matching";

export interface StoredCollection {
  matched: MatchedRow[];
  unmatched: CollectionRow[];
}

export interface CollectionSummary {
  rows: number;
  /** Copias identificadas (sin las filas que no se han podido emparejar). */
  totalCards: number;
  uniqueCards: number;
  unmatchedRows: number;
  importedAt: Date | null;
}

/** Una carta añadida suelta (a mano en la web o, en el futuro, con el escáner de la app). */
export interface ManualCard {
  oracleId: string;
  name: string;
  quantity: number;
  foil: boolean;
  scryfallId?: string | null | undefined;
  /** Idioma de la copia (código de Scryfall), si se sabe. */
  language?: string | null | undefined;
  condition?: string | null | undefined;
}

/** Lo que se puede cambiar de una línea de la colección. */
export interface CollectionLinePatch {
  quantity?: number | undefined;
  foil?: boolean | undefined;
  language?: string | null | undefined;
  condition?: string | null | undefined;
  /** Otra impresión de la misma carta (con su edición y número). */
  printing?: { scryfallId: string; setCode: string; collectorNumber: string } | undefined;
}

/** Una línea de la colección (del CSV o añadida suelta), ya emparejada con una carta. */
export interface CollectionEntryRow {
  /** Id público (uuid) de la línea; sirve para borrar las añadidas a mano. */
  id: string;
  oracleId: string;
  name: string;
  quantity: number;
  foil: boolean;
  setCode: string | null;
  collectorNumber: string | null;
  /** Impresión concreta (Scryfall ID), si se conoce. */
  scryfallId: string | null;
  /** Idioma de la copia (código de Scryfall: "en", "es"…), si se sabe. */
  language: string | null;
  /** Estado de la copia ("near_mint"…), si se sabe. */
  condition: string | null;
  source: "csv" | "manual";
  addedAt: Date;
}

/**
 * La colección de un usuario: lo importado del CSV de ManaBox más las cartas añadidas sueltas.
 * Importar un CSV reemplaza lo importado, pero no las cartas añadidas a mano.
 */
export interface CollectionRepository {
  replaceCollection(collection: StoredCollection): Promise<void>;
  addCards(cards: readonly ManualCard[]): Promise<void>;
  /** Todas las líneas emparejadas (CSV y sueltas), de la más reciente a la más antigua. */
  entries(): Promise<CollectionEntryRow[]>;
  /** Borra una carta añadida suelta (las del CSV solo cambian reimportando). */
  removeAdded(id: string): Promise<boolean>;
  /**
   * Cambia una línea cualquiera (también las del CSV, que pasan a ser "a mano" para que reimportar
   * no las pise). Devuelve false si no existe o no es mía.
   */
  updateLine(id: string, patch: CollectionLinePatch): Promise<boolean>;
  /** Borra una línea cualquiera (también del CSV). */
  removeLine(id: string): Promise<boolean>;
  summary(): Promise<CollectionSummary>;
  /** Copias que tengo de cada carta, por oracleId. */
  ownedQuantities(): Promise<Map<string, number>>;
}
