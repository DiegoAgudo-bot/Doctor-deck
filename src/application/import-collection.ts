import {
  parseManaboxCsv,
  type CollectionRow,
  type CollectionRowError,
} from "@/domain/collection/manabox";
import { matchCollection, type MatchMethod } from "@/domain/collection/matching";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import { loadIndexForCollection } from "./card-index-loader";

export interface CollectionImportSummary {
  /** Filas válidas del CSV. */
  rows: number;
  /** Copias totales (suma de Quantity). */
  totalCards: number;
  /** Cartas distintas (por oracleId) emparejadas. */
  uniqueCards: number;
  matchedRows: number;
  matchedBy: Record<MatchMethod, number>;
  /** Filas que no se han podido emparejar con ninguna carta de Scryfall. */
  unmatched: CollectionRow[];
  /** Filas inválidas del CSV. */
  errors: CollectionRowError[];
}

export class EmptyCatalogError extends Error {
  constructor() {
    super("El catálogo de Scryfall está vacío. Ejecuta `npm run scryfall:sync` primero.");
  }
}

/** Importa el CSV de ManaBox, empareja con Scryfall y reemplaza la colección guardada. */
export async function importCollection(
  csvText: string,
  deps: { cards: CardRepository; collection: CollectionRepository },
): Promise<CollectionImportSummary> {
  if ((await deps.cards.counts()).cards === 0) throw new EmptyCatalogError();

  const { rows, errors } = parseManaboxCsv(csvText);
  const index = await loadIndexForCollection(rows, deps.cards);
  const { matched, unmatched } = matchCollection(rows, index);
  await deps.collection.replaceCollection({ matched, unmatched });

  const matchedBy: Record<MatchMethod, number> = { scryfallId: 0, setNumber: 0, name: 0 };
  for (const m of matched) matchedBy[m.method] += 1;

  return {
    rows: rows.length,
    totalCards: rows.reduce((n, r) => n + r.quantity, 0),
    uniqueCards: new Set(matched.map((m) => m.oracleId)).size,
    matchedRows: matched.length,
    matchedBy,
    unmatched,
    errors,
  };
}
