import type { NextRequest } from "next/server";
import { deleteComment } from "@/application/comments";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { isAdmin, socialDeps } from "@/server/social";

/** Borrar un comentario (quien lo escribió, el dueño del mazo o un administrador). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/comments/[id]">) {
  try {
    const user = await requireUser(req);
    await deleteComment(user.id, (await ctx.params).id, socialDeps(), isAdmin(user));
    return Response.json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
