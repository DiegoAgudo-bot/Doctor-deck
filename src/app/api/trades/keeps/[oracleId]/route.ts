import type { NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Marcar (o desmarcar) una carta como "no la cambio": sale de mi lista para cambiar. */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/trades/keeps/[oracleId]">) {
  try {
    const user = await requireUser(req);
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse((await ctx.params).oracleId);
    const { keep } = z.object({ keep: z.boolean() }).parse(await req.json());
    await getContainer().tradesFor(user.id).setKeep(oracleId, keep);
    return Response.json({ oracleId, keep });
  } catch (err) {
    return errorResponse(err);
  }
}
