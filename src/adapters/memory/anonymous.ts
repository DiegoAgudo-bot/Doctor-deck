import type {
  CollectionRepository,
  CollectionSummary,
  StoredCollection,
} from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";

/**
 * Colección de un visitante sin cuenta: vive en su navegador, que la manda con cada análisis
 * (`owned`). Al importar un CSV se queda en memoria para devolvérsela al navegador; no se guarda.
 */
export class BrowserCollectionRepository implements CollectionRepository {
  private owned: Map<string, number>;
  private stored: StoredCollection | null = null;

  constructor(owned: Iterable<readonly [string, number]> = []) {
    this.owned = new Map(owned);
  }

  async replaceCollection(collection: StoredCollection) {
    this.stored = collection;
    const owned = new Map<string, number>();
    for (const m of collection.matched) {
      owned.set(m.oracleId, (owned.get(m.oracleId) ?? 0) + m.row.quantity);
    }
    this.owned = owned;
  }

  async summary(): Promise<CollectionSummary> {
    const copies = [...this.owned.values()].reduce((a, b) => a + b, 0);
    return {
      rows: this.stored ? this.stored.matched.length + this.stored.unmatched.length : 0,
      totalCards: copies,
      uniqueCards: this.owned.size,
      unmatchedRows: this.stored?.unmatched.length ?? 0,
      importedAt: null,
    };
  }

  async ownedQuantities() {
    return new Map(this.owned);
  }
}

/** Mazos de un visitante sin cuenta: ninguno (guardar exige iniciar sesión). */
export const noSavedDecks: DeckRepository = {
  list: async () => [],
  get: async () => null,
  save: async () => {
    throw new Error("Guardar mazos exige iniciar sesión");
  },
  delete: async () => false,
  usage: async () => new Map(),
};
