import type { NextRequest } from "next/server";
import { memberGroup, removeMember } from "@/application/groups";
import { notFound } from "@/application/errors";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";

/** Salir del grupo (mi propio usuario) o, si soy el dueño, quitar a alguien. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/groups/[id]/members/[username]">,
) {
  try {
    const user = await requireUser(req);
    const { id, username } = await ctx.params;
    const deps = socialDeps();
    const group = await memberGroup(id, user.id, deps);
    const member = group.members.find((m) => m.username === username.toLowerCase());
    if (!member) throw notFound("No es del grupo.");
    await removeMember(id, user.id, member.id, deps);
    return Response.json({ removed: true });
  } catch (err) {
    return errorResponse(err);
  }
}
