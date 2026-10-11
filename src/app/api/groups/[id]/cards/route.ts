import { connection, type NextRequest } from "next/server";
import { groupHolders, memberGroup } from "@/application/groups";
import { notFound } from "@/application/errors";
import { cardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { cardHolderDTO, type GroupCardDTO } from "@/server/social-dto";

/** ¿Quién del grupo tiene esta carta? `?oracleId=` (copias y cuántas libres). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/[id]/cards">) {
  await connection();
  try {
    const user = await requireUser(req);
    const oracleId = req.nextUrl.searchParams.get("oracleId") ?? "";
    const deps = socialDeps();
    const group = await memberGroup((await ctx.params).id, user.id, deps);
    const [card] = await deps.cards.findCardsByOracleIds([oracleId]);
    if (!card) throw notFound("Esa carta no existe.");
    const holders = await groupHolders(group, [oracleId], deps);
    const body: GroupCardDTO = {
      card: cardDTO(card),
      wanted: 0,
      holders: (holders.get(oracleId) ?? []).map(cardHolderDTO),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
