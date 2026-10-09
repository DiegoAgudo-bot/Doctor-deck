import type { CardRepository } from "@/domain/ports/card-repository";
import type { SavedDeckSummary } from "@/domain/ports/deck-repository";
import { savedDeckSummaryDTO, type SavedDeckSummaryDTO } from "./dto";

/** Resúmenes de mazos para la API, con la carta del comandante (imagen e identidad de color). */
export async function deckSummaries(
  decks: readonly SavedDeckSummary[],
  cards: CardRepository,
): Promise<SavedDeckSummaryDTO[]> {
  const commanders = await cards.findCardsByOracleIds([
    ...new Set(decks.flatMap((d) => d.commanders)),
  ]);
  const byId = new Map(commanders.map((card) => [card.oracleId, card]));
  return decks.map((d) => savedDeckSummaryDTO(d, byId));
}
