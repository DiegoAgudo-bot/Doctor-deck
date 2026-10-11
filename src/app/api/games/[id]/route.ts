import { connection, type NextRequest } from "next/server";
import { deleteGame, getGame } from "@/application/games";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { gameDTO } from "@/server/social-dto";

/** Una partida (para quien jugó, quien la registró y los miembros de su grupo). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/games/[id]">) {
  await connection();
  try {
    const user = await requireUser(req);
    const deps = socialDeps();
    const game = await getGame((await ctx.params).id, user.id, deps);
    const owner = game.group ? ((await deps.groups.get(game.group.id))?.ownerId ?? null) : null;
    return Response.json(gameDTO(game, user.id, owner));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/games/[id]">) {
  try {
    const user = await requireUser(req);
    await deleteGame((await ctx.params).id, user.id, socialDeps());
    return Response.json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
