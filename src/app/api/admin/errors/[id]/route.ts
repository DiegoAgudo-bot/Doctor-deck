import type { NextRequest } from "next/server";
import { forbidden } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { isAdmin } from "@/server/social";

/** Borra un error del registro (ya revisado o arreglado). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/errors/[id]">) {
  try {
    const user = await requireUser(req);
    if (!isAdmin(user)) throw forbidden("Solo para administradores.");
    const id = Number((await ctx.params).id);
    if (Number.isInteger(id) && id > 0) await getContainer().errorLog.clear(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
