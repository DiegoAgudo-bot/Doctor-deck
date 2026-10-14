import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { deckVersions } from "@/application/deck-versions";
import { notFound } from "@/application/errors";
import { getContainer } from "@/server/container";
import type { DeckVersionDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Historial de uno de mis mazos: versiones anteriores con lo que cambió después de cada una. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/versions">) {
  await connection();
  try {
    const user = await requireUser(req);
    const id = (await ctx.params).id;
    if (!z.uuid().safeParse(id).success) throw notFound("Ese mazo no existe.");
    const c = getContainer();
    const versions = await deckVersions(id, { decks: c.decksFor(user.id), cards: c.cards });
    const body: DeckVersionDTO[] = versions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    }));
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
