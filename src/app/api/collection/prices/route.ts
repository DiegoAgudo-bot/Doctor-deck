import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { collectionPrices } from "@/application/prices";
import { getContainer } from "@/server/container";
import { cardDTO, type CollectionPricesDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

const schema = z.object({
  days: z.number().int().min(7).max(365).default(30),
  /** Sin sesión: la colección guardada en el navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
});

/** El valor de mi colección día a día y las cartas que más han subido y bajado. */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { days, collection } = schema.parse(await request.json());
    const c = getContainer();
    const owned = await (
      user ? c.collectionFor(user.id) : new BrowserCollectionRepository(collection)
    ).ownedQuantities();
    const r = await collectionPrices({ owned, days, limit: 8 }, { prices: c.prices });
    const ids = [...r.up, ...r.down].map((m) => m.oracleId);
    const byId = new Map((await c.cards.findCardsByOracleIds(ids)).map((x) => [x.oracleId, x]));
    const mover = (m: (typeof r.up)[number]) => {
      const card = byId.get(m.oracleId);
      return card
        ? [{ card: cardDTO(card), copies: m.copies, ...m.change, valueDelta: m.valueDelta }]
        : [];
    };
    const body: CollectionPricesDTO = {
      since: r.since,
      latest: r.latest,
      value: r.value,
      up: r.up.flatMap(mover),
      down: r.down.flatMap(mover),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
