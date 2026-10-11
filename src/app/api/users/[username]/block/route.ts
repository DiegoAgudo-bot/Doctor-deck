import type { NextRequest } from "next/server";
import { setBlocked } from "@/application/comments";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";

async function handle(req: NextRequest, username: string, block: boolean) {
  try {
    const user = await requireUser(req);
    await setBlocked(user.id, username, block, socialDeps());
    return Response.json({ blocked: block });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Bloquear: deja de seguirme (y yo a él), no comenta mis mazos ni me propone intercambios. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/users/[username]/block">) {
  return handle(req, (await ctx.params).username, true);
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/users/[username]/block">) {
  return handle(req, (await ctx.params).username, false);
}
