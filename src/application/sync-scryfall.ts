import type { Card, Printing } from "@/domain/cards/types";
import type { CardCatalogWriter } from "@/domain/ports/card-repository";

export interface BulkSources {
  /** Elementos crudos del bulk oracle_cards. */
  oracleCards(): AsyncIterable<unknown>;
  /** Elementos crudos del bulk default_cards. */
  defaultCards(): AsyncIterable<unknown>;
}

export interface BulkMappers {
  toCard(raw: unknown): Card | null;
  toPrinting(raw: unknown): Printing | null;
}

export interface SyncResult {
  cards: number;
  printings: number;
  /** Objetos descartados: inválidos, sin oracle_id o con oracle_id desconocido. */
  skipped: number;
}

const BATCH = 1000;

/** Vuelca los bulk de Scryfall al catálogo local (lo vacía antes). */
export async function syncScryfallCatalog(
  bulk: BulkSources,
  map: BulkMappers,
  writer: CardCatalogWriter,
  onProgress: (msg: string) => void = () => undefined,
): Promise<SyncResult> {
  await writer.clearCatalog();
  const oracleIds = new Set<string>();
  let skipped = 0;

  let cards: Card[] = [];
  for await (const raw of bulk.oracleCards()) {
    const card = map.toCard(raw);
    if (!card || oracleIds.has(card.oracleId)) {
      skipped += 1;
      continue;
    }
    oracleIds.add(card.oracleId);
    cards.push(card);
    if (cards.length >= BATCH) {
      await writer.insertCards(cards);
      cards = [];
      onProgress(`cartas: ${oracleIds.size}`);
    }
  }
  await writer.insertCards(cards);

  const seen = new Set<string>();
  let printings: Printing[] = [];
  for await (const raw of bulk.defaultCards()) {
    const p = map.toPrinting(raw);
    if (!p || !oracleIds.has(p.oracleId) || seen.has(p.scryfallId)) {
      skipped += 1;
      continue;
    }
    seen.add(p.scryfallId);
    printings.push(p);
    if (printings.length >= BATCH) {
      await writer.insertPrintings(printings);
      printings = [];
      onProgress(`impresiones: ${seen.size}`);
    }
  }
  await writer.insertPrintings(printings);

  return { cards: oracleIds.size, printings: seen.size, skipped };
}
