import type { NextRequest } from "next/server";
import { z } from "zod";
import { restoreDeckVersion } from "@/application/deck-versions";
import { notFound } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Restaura una versión anterior de uno de mis mazos (la actual pasa al historial). */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/decks/[id]/versions/[versionId]">,
) {
  try {
    const user = await requireUser(req);
    const { id, versionId } = await ctx.params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(versionId).success) {
      throw notFound("Esa versión no existe.");
    }
    const c = getContainer();
    const saved = await restoreDeckVersion(id, versionId, {
      sources: c.deckSources,
      cards: c.cards,
      decks: c.decksFor(user.id),
    });
    return Response.json(saved);
  } catch (err) {
    return errorResponse(err);
  }
}
