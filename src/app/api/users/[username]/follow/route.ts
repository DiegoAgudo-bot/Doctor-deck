import type { NextRequest } from "next/server";
import { setFollowing } from "@/application/social";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

async function handle(req: NextRequest, username: string, follow: boolean) {
  try {
    const user = await requireUser(req);
    const c = getContainer();
    const counts = await setFollowing(user.id, username, follow, {
      profiles: c.social,
      follows: c.social,
    });
    return Response.json({ isFollowing: follow, ...counts });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Seguir a un usuario. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/users/[username]/follow">) {
  return handle(req, (await ctx.params).username, true);
}

/** Dejar de seguirle. */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/users/[username]/follow">) {
  return handle(req, (await ctx.params).username, false);
}
