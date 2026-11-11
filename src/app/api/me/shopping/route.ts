import { connection } from "next/server";
import { shoppingList } from "@/domain/deck/shopping";
import { getContainer } from "@/server/container";
import { cardDTO, type ShoppingListDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/**
 * Lista de la compra de todos mis mazos: lo que falta para tenerlos montados a la vez, con el
 * precio de referencia y qué mazos piden cada carta. De la más cara a la más barata.
 */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const c = getContainer();
    const decks = c.decksFor(user.id);
    const [owned, usage, mine] = await Promise.all([
      c.collectionFor(user.id).ownedQuantities(),
      decks.usage(),
      decks.list(),
    ]);
    const basics = await c.cards.findBasicLandIds([...usage.keys()]);
    const missing = shoppingList({ usage, owned, basics });
    const ids = missing.map((m) => m.oracleId);
    const [cards, prices] = await Promise.all([
      c.cards.findCardsByOracleIds(ids),
      c.cards.findMinPrices(ids),
    ]);
    const byId = new Map(cards.map((card) => [card.oracleId, card]));
    const items = missing
      .flatMap((m) => {
        const card = byId.get(m.oracleId);
        return card
          ? [
              {
                card: cardDTO(card),
                quantity: m.quantity,
                price: prices.get(m.oracleId) ?? null,
                // Solo los mazos (un préstamo no es un mazo que la pida).
                decks: m.decks.flatMap((d) => (d.id ? [{ id: d.id, name: d.name }] : [])),
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          (b.price ?? 0) * b.quantity - (a.price ?? 0) * a.quantity ||
          a.card.name.localeCompare(b.card.name),
      );
    const body: ShoppingListDTO = {
      items,
      decks: mine.map((d) => ({ id: d.id, name: d.name })),
      copies: items.reduce((n, i) => n + i.quantity, 0),
      cost: items.reduce((n, i) => n + (i.price ?? 0) * i.quantity, 0),
      unpriced: items.filter((i) => i.price === null).length,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
