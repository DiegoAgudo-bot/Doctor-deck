import type { NextRequest } from "next/server";
import { z } from "zod";
import { moderateComment } from "@/application/comments";
import { forbidden } from "@/application/errors";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { isAdmin, socialDeps } from "@/server/social";

const schema = z.object({ action: z.enum(["keep", "hide", "delete"]) });

/** Revisar un comentario denunciado: dejarlo, ocultarlo o borrarlo. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]">) {
  try {
    const user = await requireUser(req);
    if (!isAdmin(user)) throw forbidden("Solo para administradores.");
    const { action } = schema.parse(await req.json());
    await moderateComment((await ctx.params).id, action, socialDeps());
    return Response.json({ done: action });
  } catch (err) {
    return errorResponse(err);
  }
}
