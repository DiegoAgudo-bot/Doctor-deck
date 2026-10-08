import type { CollectionRow } from "../collection/manabox";
import type { MatchedRow } from "../collection/matching";

export interface StoredCollection {
  matched: MatchedRow[];
  unmatched: CollectionRow[];
}

export interface CollectionSummary {
  rows: number;
  totalCards: number;
  uniqueCards: number;
  unmatchedRows: number;
  importedAt: Date | null;
}

/** MVP: una única colección por instalación; importar la reemplaza entera. */
export interface CollectionRepository {
  replaceCollection(collection: StoredCollection): Promise<void>;
  summary(): Promise<CollectionSummary>;
  /** Copias que tengo de cada carta, por oracleId. */
  ownedQuantities(): Promise<Map<string, number>>;
}
