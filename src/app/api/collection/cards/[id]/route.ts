import type { NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Quita una carta añadida suelta (las del CSV solo cambian reimportándolo). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/collection/cards/[id]">) {
  try {
    const user = await requireUser(req);
    const removed = await getContainer()
      .collectionFor(user.id)
      .removeAdded((await ctx.params).id);
    return removed
      ? new Response(null, { status: 204 })
      : Response.json(
          { error: { code: "not_found", message: "Esa carta no está entre las añadidas a mano" } },
          { status: 404 },
        );
  } catch (err) {
    return errorResponse(err);
  }
}
