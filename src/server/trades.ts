import type { Card } from "@/domain/cards/types";
import type { ListedCard } from "@/domain/trades/lists";
import { getContainer } from "./container";
import { cardDTO, type TradeCardDTO } from "./dto";

/** Dependencias de los casos de uso de intercambio, desde el contenedor. */
export function tradeDeps() {
  const c = getContainer();
  return {
    cards: c.cards,
    collectionFor: (id: string) => c.collectionFor(id),
    decksFor: (id: string) => c.decksFor(id),
    tradesFor: (id: string) => c.tradesFor(id),
    profiles: c.social,
    follows: c.social,
    notifications: c.social,
  };
}

/** Pasa cartas de una lista a DTOs (con carta del catálogo y precio); las desconocidas se omiten. */
export async function tradeCards(
  items: readonly ListedCard[],
  prices: ReadonlyMap<string, number>,
): Promise<{ dto: TradeCardDTO[]; byId: Map<string, Card> }> {
  const found = await getContainer().cards.findCardsByOracleIds(items.map((i) => i.oracleId));
  const byId = new Map(found.map((c) => [c.oracleId, c]));
  const dto = items.flatMap((i) => {
    const card = byId.get(i.oracleId);
    return card
      ? [{ card: cardDTO(card), quantity: i.quantity, price: prices.get(i.oracleId) ?? null }]
      : [];
  });
  return { dto, byId };
}
