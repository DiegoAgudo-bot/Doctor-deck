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
}

/** Una línea de la colección (del CSV o añadida suelta), ya emparejada con una carta. */
export interface CollectionEntryRow {
  /** Id de la línea; sirve para borrar las añadidas a mano. */
  id: string;
  oracleId: string;
  name: string;
  quantity: number;
  foil: boolean;
  setCode: string | null;
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
  summary(): Promise<CollectionSummary>;
  /** Copias que tengo de cada carta, por oracleId. */
  ownedQuantities(): Promise<Map<string, number>>;
}
