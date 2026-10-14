import type { NextRequest } from "next/server";
import { z } from "zod";
import { closeLoan } from "@/application/loans";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { readJson } from "@/server/body";

const patchSchema = z.object({ action: z.literal("returned") });

/** Marcar como devuelto (quien prestó o quien la tiene). */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/loans/[id]">) {
  try {
    const user = await requireUser(req);
    patchSchema.parse(await readJson(req));
    await closeLoan((await ctx.params).id, user.id, "returned", socialDeps());
    return Response.json({ returned: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Borrar un préstamo apuntado por error (solo quien prestó). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/loans/[id]">) {
  try {
    const user = await requireUser(req);
    await closeLoan((await ctx.params).id, user.id, "delete", socialDeps());
    return Response.json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
