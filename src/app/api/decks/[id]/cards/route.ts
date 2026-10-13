import type { NextRequest } from "next/server";
import { z } from "zod";
import { addCardToDeck } from "@/application/add-card-to-deck";
import { notFound } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

const schema = z.object({ oracleId: z.string().min(1).max(64) });

/** Añade una copia de una carta a uno de mis mazos (desde la colección, la ficha…). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/cards">) {
  try {
    const user = await requireUser(req);
    const id = (await ctx.params).id;
    if (!z.uuid().safeParse(id).success) throw notFound("Ese mazo no existe.");
    const { oracleId } = schema.parse(await req.json());
    const c = getContainer();
    const added = await addCardToDeck(id, oracleId, {
      sources: c.deckSources,
      cards: c.cards,
      decks: c.decksFor(user.id),
    });
    return Response.json(added);
  } catch (err) {
    return errorResponse(err);
  }
}
