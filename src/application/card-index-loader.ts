import { InMemoryCardIndex } from "@/domain/cards/card-index";
import { frontFace, nameKey } from "@/domain/cards/names";
import type { Card, Printing } from "@/domain/cards/types";
import type { CollectionRow } from "@/domain/collection/manabox";
import type { DecklistEntry } from "@/domain/deck/decklist";
import type { CardRepository } from "@/domain/ports/card-repository";

interface Lookup {
  name: string;
  scryfallId?: string | null;
  setCode: string | null;
  collectorNumber: string | null;
}

/**
 * Carga del repositorio solo lo necesario para resolver `lookups` y lo mete en un índice en
 * memoria: impresiones por id, luego por set+número para las que falten, y cartas por nombre.
 */
export async function loadIndexFor(
  lookups: readonly Lookup[],
  repo: CardRepository,
): Promise<InMemoryCardIndex> {
  const ids = lookups.flatMap((l) => (l.scryfallId ? [l.scryfallId] : []));
  const printings: Printing[] = ids.length > 0 ? await repo.findPrintingsByIds(ids) : [];
  const foundIds = new Set(printings.map((p) => p.scryfallId.toLowerCase()));

  const pending = lookups.filter((l) => !l.scryfallId || !foundIds.has(l.scryfallId.toLowerCase()));
  const pairs = pending.flatMap((l) =>
    l.setCode && l.collectorNumber
      ? [{ setCode: l.setCode, collectorNumber: l.collectorNumber }]
      : [],
  );
  if (pairs.length > 0) printings.push(...(await repo.findPrintingsBySetNumbers(pairs)));

  const keys = pending.flatMap((l) => [nameKey(l.name), nameKey(frontFace(l.name))]);
  const byName = keys.length > 0 ? await repo.findCardsByNameKeys(keys) : [];

  const known = new Set(byName.map((c) => c.oracleId));
  const missing = [...new Set(printings.map((p) => p.oracleId))].filter((id) => !known.has(id));
  const cards: Card[] = [
    ...byName,
    ...(missing.length > 0 ? await repo.findCardsByOracleIds(missing) : []),
  ];

  return new InMemoryCardIndex(cards, printings);
}

export const loadIndexForCollection = (rows: readonly CollectionRow[], repo: CardRepository) =>
  loadIndexFor(rows, repo);

export const loadIndexForDecklist = (entries: readonly DecklistEntry[], repo: CardRepository) =>
  loadIndexFor(entries, repo);
