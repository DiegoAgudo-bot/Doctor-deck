import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { addToCollection } from "@/application/collection-cards";
import { getContainer } from "@/server/container";
import { addCardsResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

const schema = z.object({
  cards: z
    .array(
      z
        .object({
          oracleId: z.string().min(1).max(64).optional(),
          scryfallId: z.uuid().optional(),
          name: z.string().min(1).max(200).optional(),
          quantity: z.number().int().min(1).max(999),
          foil: z.boolean().optional(),
        })
        .refine((c) => c.oracleId ?? c.scryfallId ?? c.name, {
          message: "Cada carta necesita oracleId, scryfallId o name",
        }),
    )
    .min(1)
    .max(500),
});

/**
 * Añade cartas sueltas a la colección (a mano en la web; en el futuro, el escáner de la app).
 * Con sesión se guardan en la cuenta; sin ella solo se resuelven y el navegador las guarda.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { cards } = schema.parse(await request.json());
    const c = getContainer();
    const result = await addToCollection(cards, {
      cards: c.cards,
      collection: user ? c.collectionFor(user.id) : new BrowserCollectionRepository(),
    });
    return Response.json(addCardsResponse(result, user !== null));
  } catch (err) {
    return errorResponse(err);
  }
}
