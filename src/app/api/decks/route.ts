import { connection } from "next/server";
import { z } from "zod";
import { saveDeck } from "@/application/save-deck";
import { getContainer } from "@/server/container";
import { savedDeckSummaryDTO } from "@/server/dto";
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
});

/** Mis mazos guardados. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const c = getContainer();
    const decks = await c.decksFor(user.id).list();
    const commanders = await c.cards.findCardsByOracleIds([
      ...new Set(decks.flatMap((d) => d.commanders)),
    ]);
    const byId = new Map(commanders.map((card) => [card.oracleId, card]));
    return Response.json(decks.map((d) => savedDeckSummaryDTO(d, byId)));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Crea o actualiza (si viene `id`) un mazo guardado. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const req = saveSchema.parse(await request.json());
    const c = getContainer();
    return Response.json(
      await saveDeck(req, { sources: c.deckSources, cards: c.cards, decks: c.decksFor(user.id) }),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
