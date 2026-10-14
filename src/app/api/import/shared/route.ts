import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { importShared } from "@/application/shared-import";
import { announceBigCards } from "@/application/social";
import { socialConfig } from "@/config/social";
import { getContainer } from "@/server/container";
import { cardWithPrintingDTO, type SharedImportResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser, requireUser } from "@/server/session";
import { BODY_LIMIT, readJson } from "@/server/body";
import { clientKey, enforceLimit, routeLimits } from "@/server/rate-limit";

const schema = z.object({
  /** El texto o el CSV tal cual llega al compartir. */
  text: z.string().min(1).max(5_000_000),
  /** false = solo ver qué se añadiría; true = añadirlo a mi colección (exige sesión). */
  save: z.boolean().default(false),
});

/**
 * Importa lo compartido desde ManaBox a la app (CSV o lista `1 Carta (SET) 123 *F*`) como cartas
 * sueltas de mi colección. Primero se pide sin `save` para enseñar lo que se va a añadir.
 * Reemplazar la colección entera con el CSV sigue siendo `POST /api/collection`; crear un mazo con
 * la lista, `POST /api/decks`.
 */
export async function POST(request: Request) {
  try {
    const { text, save } = schema.parse(await readJson(request, BODY_LIMIT.large));
    const user = save ? await requireUser(request) : await currentUser(request);
    enforceLimit(routeLimits.importShared, clientKey(request, user?.id));
    const c = getContainer();
    const result = await importShared(text, {
      cards: c.cards,
      collection: save && user ? c.collectionFor(user.id) : new BrowserCollectionRepository(),
    });
    if (save && user) {
      await announceBigCards(
        user.id,
        result.added.map((a) => ({ oracleId: a.card.oracleId, name: a.card.name })),
        { profiles: c.social, follows: c.social, notifications: c.social, cards: c.cards },
        socialConfig,
      );
    }
    const ids = result.added.flatMap((a) => (a.scryfallId ? [a.scryfallId] : []));
    const printings = new Map(
      (ids.length > 0 ? await c.cards.findPrintingsByIds(ids) : []).map((p) => [
        p.scryfallId.toLowerCase(),
        p,
      ]),
    );
    const body: SharedImportResponse = {
      kind: result.kind,
      name: result.name,
      added: result.added.map((a) => ({
        card: cardWithPrintingDTO(
          a.card,
          a.scryfallId ? printings.get(a.scryfallId.toLowerCase()) : undefined,
        ),
        quantity: a.quantity,
        foil: a.foil,
        language: a.language,
      })),
      notFound: result.notFound,
      totalCopies: result.totalCopies,
      looksLikeDeck: result.looksLikeDeck,
      skipped: result.skipped,
      saved: Boolean(save && user),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
