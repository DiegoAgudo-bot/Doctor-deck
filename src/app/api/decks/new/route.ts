import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { newDeckFromCommander } from "@/application/new-deck";
import { DECK_VISIBILITIES } from "@/domain/deck/visibility";
import { saveDeck } from "@/application/save-deck";
import { announceNewDeck } from "@/application/social";
import { getContainer } from "@/server/container";
import type { NewDeckResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

const schema = z.object({
  commanderIds: z.array(z.string().min(1).max(64)).min(1).max(2),
  mode: z.enum(["average", "owned", "empty"]),
  theme: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /** Si no viene, "<colores> - <de qué va>". */
  name: z.string().trim().max(120).optional(),
  visibility: z.enum(DECK_VISIBILITIES).optional(),
  /** Sin sesión, con "owned": la colección del navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
});

/**
 * Crea un mazo a partir del comandante: el mazo medio de EDHREC o vacío (para montarlo desde
 * cero). Con sesión se guarda en "Mis mazos"; sin ella se devuelve la lista para abrirla en /analyze.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const req = schema.parse(await request.json());
    const c = getContainer();
    const deck = await newDeckFromCommander(req, {
      cards: c.cards,
      recommendations: c.edhrec,
      averageDecks: c.edhrec,
      collection: user
        ? c.collectionFor(user.id)
        : req.collection
          ? new BrowserCollectionRepository(req.collection)
          : undefined,
      usage: user ? () => c.decksFor(user.id).usage() : undefined,
    });
    const name = req.name || deck.name;
    if (!user) {
      const body: NewDeckResponse = {
        saved: false,
        id: null,
        name,
        input: deck.input,
        theme: deck.theme,
        warning: deck.warning,
      };
      return Response.json(body);
    }
    const visibility = req.visibility ?? "public";
    const saved = await saveDeck(
      {
        input: deck.input,
        name,
        commanders: [...req.commanderIds],
        visibility,
        ...(deck.theme ? { theme: deck.theme } : {}),
      },
      { sources: c.deckSources, cards: c.cards, decks: c.decksFor(user.id) },
    );
    await announceNewDeck(
      user.id,
      { id: saved.id, name: saved.name, visibility },
      { follows: c.social, notifications: c.social },
    );
    const body: NewDeckResponse = {
      saved: true,
      id: saved.id,
      name: saved.name,
      input: deck.input,
      theme: deck.theme,
      warning: deck.warning,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
