import type { NextRequest } from "next/server";
import { z } from "zod";
import { addCardToDeck, changeDeckCards } from "@/application/add-card-to-deck";
import { notFound } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

const oracleId = z.string().min(1).max(64);
const addSchema = z.object({ oracleId });
const changeSchema = z.object({
  changes: z
    .array(z.object({ oracleId, delta: z.number().int().min(-99).max(99) }))
    .min(1)
    .max(100),
});

async function deps(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/cards">) {
  const user = await requireUser(req);
  const id = (await ctx.params).id;
  if (!z.uuid().safeParse(id).success) throw notFound("Ese mazo no existe.");
  const c = getContainer();
  return { id, deps: { sources: c.deckSources, cards: c.cards, decks: c.decksFor(user.id) } };
}

/** Añade una copia de una carta a uno de mis mazos (desde la colección, la ficha…). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/cards">) {
  try {
    const { id, deps: d } = await deps(req, ctx);
    const body = addSchema.parse(await req.json());
    return Response.json(await addCardToDeck(id, body.oracleId, d));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Cambia varias cartas a la vez (`{changes: [{oracleId, delta}]}`): primero se quitan copias y
 * luego se añaden. La app lo usa para aplicar cambios sugeridos y quitar cartas.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/cards">) {
  try {
    const { id, deps: d } = await deps(req, ctx);
    const body = changeSchema.parse(await req.json());
    return Response.json(await changeDeckCards(id, body.changes, d));
  } catch (err) {
    return errorResponse(err);
  }
}
