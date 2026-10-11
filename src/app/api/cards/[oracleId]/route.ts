import { connection, type NextRequest } from "next/server";
import { cardDetail } from "@/application/card-catalog";
import { cardDetailDTO, type CardDetailDTO } from "@/server/card-dto";
import { getContainer } from "@/server/container";
import { deckSummaries } from "@/server/deck-summaries";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

/** Ficha de una carta (pública; con sesión, además mis copias y mi lista de deseos). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/cards/[oracleId]">) {
  await connection();
  try {
    const viewer = await currentUser(req);
    const c = getContainer();
    const detail = await cardDetail(
      (await ctx.params).oracleId.slice(0, 64),
      viewer?.id ?? null,
      c,
    );
    const [summaries, owners] = await Promise.all([
      deckSummaries(detail.commanderDecks, c.cards),
      Promise.all(detail.commanderDecks.map((d) => c.social.byId(d.ownerId))),
    ]);
    const body: CardDetailDTO = cardDetailDTO(
      detail,
      summaries.map((s, i) => ({ ...s, owner: owners[i]?.username ?? null })),
    );
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
