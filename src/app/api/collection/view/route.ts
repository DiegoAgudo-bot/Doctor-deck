import { z } from "zod";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import { collectionView } from "@/application/collection-cards";
import { getContainer } from "@/server/container";
import { collectionCardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

const schema = z.object({
  /** Sin sesión: la colección del navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
});

/**
 * La colección agrupada por carta, con catálogo, precio, roles y mazos que la usan. POST porque
 * sin sesión el navegador manda su colección en el cuerpo.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { collection } = schema.parse(await request.json().catch(() => ({})));
    const c = getContainer();
    const cards = await collectionView({
      cards: c.cards,
      collection: user ? c.collectionFor(user.id) : new BrowserCollectionRepository(collection),
      decks: user ? c.decksFor(user.id) : noSavedDecks,
      classifier: c.classifier,
    });
    return Response.json(cards.map(collectionCardDTO));
  } catch (err) {
    return errorResponse(err);
  }
}
