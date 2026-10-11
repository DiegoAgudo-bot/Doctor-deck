import { connection, type NextRequest } from "next/server";
import { groupCanLend, memberGroup } from "@/application/groups";
import { cardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { cardHolderDTO, type GroupCardDTO } from "@/server/social-dto";

/** Lo que me falta y alguien del grupo tiene libre (para pedírselo prestado). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/[id]/can-lend">) {
  await connection();
  try {
    const user = await requireUser(req);
    const deps = socialDeps();
    const group = await memberGroup((await ctx.params).id, user.id, deps);
    const rows = await groupCanLend(group, user.id, deps);
    const cards = new Map(
      (await deps.cards.findCardsByOracleIds(rows.map((r) => r.oracleId))).map((c) => [
        c.oracleId,
        c,
      ]),
    );
    const body: GroupCardDTO[] = rows.flatMap((r) => {
      const card = cards.get(r.oracleId);
      return card
        ? [{ card: cardDTO(card), wanted: r.wanted, holders: r.holders.map(cardHolderDTO) }]
        : [];
    });
    body.sort((a, b) => a.card.name.localeCompare(b.card.name, "es"));
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
