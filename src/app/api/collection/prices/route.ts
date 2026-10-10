import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { collectionPrices } from "@/application/prices";
import { getContainer } from "@/server/container";
import { cardWithPrintingDTO, type CollectionPricesDTO } from "@/server/dto";
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
    // Con cuenta, cada copia con su impresión y si es foil; sin cuenta, solo cartas y copias.
    const entries = await (
      user ? c.collectionFor(user.id) : new BrowserCollectionRepository(collection)
    ).entries();
    const r = await collectionPrices(
      {
        holdings: entries.map((e) => ({
          oracleId: e.oracleId,
          scryfallId: e.scryfallId,
          foil: e.foil,
          quantity: e.quantity,
        })),
        days,
        limit: 8,
      },
      { prices: c.prices },
    );
    const holdings = [...r.up, ...r.down].flatMap((m) => {
      const h = r.info.get(m.oracleId);
      return h ? [h] : [];
    });
    const [cards, printings] = await Promise.all([
      c.cards.findCardsByOracleIds(holdings.map((h) => h.oracleId)),
      c.cards.findPrintingsByIds(holdings.flatMap((h) => (h.scryfallId ? [h.scryfallId] : []))),
    ]);
    const byId = new Map(cards.map((x) => [x.oracleId, x]));
    const byPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
    const mover = (m: (typeof r.up)[number]) => {
      // En `up`/`down`, `oracleId` es la clave de la impresión (ver `collectionPrices`).
      const h = r.info.get(m.oracleId);
      const card = h && byId.get(h.oracleId);
      if (!h || !card) return [];
      const p = h.scryfallId ? byPrinting.get(h.scryfallId.toLowerCase()) : undefined;
      return [
        {
          card: cardWithPrintingDTO(card, p),
          foil: h.scryfallId ? h.foil : null,
          copies: m.copies,
          ...m.change,
          valueDelta: m.valueDelta,
        },
      ];
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
