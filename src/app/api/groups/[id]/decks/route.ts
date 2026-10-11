import { connection, type NextRequest } from "next/server";
import { groupDecks, memberGroup } from "@/application/groups";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { groupDeckDTO } from "@/server/social-dto";

/** Los mazos públicos y ocultos de los miembros del grupo. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/[id]/decks">) {
  await connection();
  try {
    const user = await requireUser(req);
    const deps = socialDeps();
    const decks = await groupDecks(await memberGroup((await ctx.params).id, user.id, deps), deps);
    const cards = await deps.cards.findCardsByOracleIds([
      ...new Set(decks.flatMap((d) => d.commanders)),
    ]);
    const byId = new Map(cards.map((c) => [c.oracleId, c]));
    return Response.json(decks.map((d) => groupDeckDTO(d, byId)));
  } catch (err) {
    return errorResponse(err);
  }
}
