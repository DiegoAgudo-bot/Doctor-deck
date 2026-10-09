import { connection } from "next/server";
import { z } from "zod";
import { saveDeck } from "@/application/save-deck";
import { announceNewDeck } from "@/application/social";
import { deckSummaries } from "@/server/deck-summaries";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

const ids = z.array(z.string().min(1).max(64)).max(200).optional();

const saveSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().max(120).optional(),
  input: z.string().min(1).max(50_000),
  theme: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  commanders: z.array(z.string().min(1).max(64)).max(2).optional(),
  locked: ids,
  excluded: ids,
  isPublic: z.boolean().optional(),
});

/** Mis mazos guardados. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const c = getContainer();
    return Response.json(await deckSummaries(await c.decksFor(user.id).list(), c.cards));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Crea o actualiza (si viene `id`) un mazo guardado. Si es nuevo y público, avisa a quien te sigue. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const req = saveSchema.parse(await request.json());
    const c = getContainer();
    const saved = await saveDeck(req, {
      sources: c.deckSources,
      cards: c.cards,
      decks: c.decksFor(user.id),
    });
    if (req.id === undefined) {
      await announceNewDeck(
        user.id,
        { id: saved.id, name: saved.name, isPublic: req.isPublic ?? true },
        { follows: c.social, notifications: c.social },
      );
    }
    return Response.json(saved);
  } catch (err) {
    return errorResponse(err);
  }
}
