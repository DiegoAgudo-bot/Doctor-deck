import type { NextRequest } from "next/server";
import { z } from "zod";
import { reportComment } from "@/application/comments";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { readJson } from "@/server/body";

const reportSchema = z.object({ reason: z.enum(["spam", "abuse", "other"]) });

/** Denunciar un comentario. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/comments/[id]/report">) {
  try {
    const user = await requireUser(req);
    const { reason } = reportSchema.parse(await readJson(req));
    return Response.json(await reportComment(user.id, (await ctx.params).id, reason, socialDeps()));
  } catch (err) {
    return errorResponse(err);
  }
}
