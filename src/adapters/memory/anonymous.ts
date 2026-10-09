import type {
  CollectionEntryRow,
  CollectionRepository,
  CollectionSummary,
  ManualCard,
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

  /** Las cartas sueltas del visitante viven en su navegador; aquí solo cuentan para esta petición. */
  async addCards(cards: readonly ManualCard[]) {
    for (const c of cards) {
      this.owned.set(c.oracleId, (this.owned.get(c.oracleId) ?? 0) + c.quantity);
    }
  }

  /** Sin detalle de líneas: una por carta con las copias que manda el navegador. */
  async entries(): Promise<CollectionEntryRow[]> {
    const at = new Date(0);
    return [...this.owned].map(([oracleId, quantity]) => ({
      id: oracleId,
      oracleId,
      name: "",
      quantity,
      foil: false,
      setCode: null,
      source: "csv",
      addedAt: at,
    }));
  }

  async removeAdded() {
    return false;
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
