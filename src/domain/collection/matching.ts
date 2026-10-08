import type { CardIndex } from "../cards/card-index";
import type { CollectionRow } from "./manabox";

export type MatchMethod = "scryfallId" | "setNumber" | "name";

export interface MatchedRow {
  row: CollectionRow;
  oracleId: string;
  scryfallId: string | null;
  method: MatchMethod;
}

export interface CollectionMatchResult {
  matched: MatchedRow[];
  unmatched: CollectionRow[];
}

/**
 * Empareja cada fila con una carta: primero por Scryfall ID, después por set + número de
 * coleccionista y, por último, por nombre.
 */
export function matchCollection(
  rows: readonly CollectionRow[],
  index: CardIndex,
): CollectionMatchResult {
  const matched: MatchedRow[] = [];
  const unmatched: CollectionRow[] = [];

  for (const row of rows) {
    const byId = row.scryfallId ? index.printingById(row.scryfallId) : undefined;
    if (byId) {
      matched.push({
        row,
        oracleId: byId.oracleId,
        scryfallId: byId.scryfallId,
        method: "scryfallId",
      });
      continue;
    }
    const bySet =
      row.setCode && row.collectorNumber
        ? index.printingBySetNumber(row.setCode, row.collectorNumber)
        : undefined;
    if (bySet) {
      matched.push({
        row,
        oracleId: bySet.oracleId,
        scryfallId: bySet.scryfallId,
        method: "setNumber",
      });
      continue;
    }
    const byName = index.cardByName(row.name);
    if (byName) {
      matched.push({ row, oracleId: byName.oracleId, scryfallId: null, method: "name" });
      continue;
    }
    unmatched.push(row);
  }
  return { matched, unmatched };
}

/** Copias totales que tengo de cada carta (todas las impresiones juntas). */
export function ownedQuantities(matched: readonly MatchedRow[]): Map<string, number> {
  const owned = new Map<string, number>();
  for (const m of matched) owned.set(m.oracleId, (owned.get(m.oracleId) ?? 0) + m.row.quantity);
  return owned;
}
