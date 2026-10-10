import { connection } from "next/server";
import { userLists } from "@/application/trades";
import { getContainer } from "@/server/container";
import { cardDTO, type MyTradesDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { tradeCards, tradeDeps } from "@/server/trades";

const TRADELIST_LIMIT = 300;

/** Mis listas: deseos (a mano y de los mazos marcados) y "para cambiar" (copias libres). */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const c = getContainer();
    const [lists, profile, decks] = await Promise.all([
      userLists(user.id, tradeDeps()),
      c.social.byId(user.id),
      c.decksFor(user.id).list(),
    ]);
    const prices = await c.cards.findMinPrices([
      ...lists.wishlist.map((w) => w.oracleId),
      ...lists.tradelist.map((t) => t.oracleId),
    ]);
    const value = (id: string, q: number) => (prices.get(id) ?? 0) * q;
    const tradelist = [...lists.tradelist].sort(
      (a, b) => value(b.oracleId, b.quantity) - value(a.oracleId, a.quantity),
    );
    const [wish, trade, keep] = await Promise.all([
      tradeCards(lists.wishlist, prices),
      tradeCards(tradelist.slice(0, TRADELIST_LIMIT), prices),
      c.cards.findCardsByOracleIds([...lists.keep]),
    ]);
    const extra = new Map(lists.wishlist.map((w) => [w.oracleId, w]));
    const body: MyTradesDTO = {
      public: profile?.tradesPublic ?? false,
      wishlist: wish.dto
        .map((d) => ({
          ...d,
          manual: extra.get(d.card.oracleId)?.manual ?? 0,
          forDecks: extra.get(d.card.oracleId)?.forDecks ?? 0,
        }))
        .sort((a, b) => (b.price ?? 0) * b.quantity - (a.price ?? 0) * a.quantity),
      tradelist: trade.dto,
      tradelistTotal: tradelist.length,
      keep: keep.map(cardDTO).sort((a, b) => a.name.localeCompare(b.name)),
      decks: decks.map((d) => ({
        id: d.id,
        name: d.name,
        inWishlist: d.inWishlist,
        commanderNames: d.commanderNames,
      })),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
