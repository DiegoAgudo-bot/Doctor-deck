import type { NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Cuántas copias quiero de una carta en mi lista de deseos (0 = quitarla). */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/trades/wishes/[oracleId]">) {
  try {
    const user = await requireUser(req);
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse((await ctx.params).oracleId);
    const { quantity } = z
      .object({ quantity: z.number().int().min(0).max(99) })
      .parse(await req.json());
    await getContainer().tradesFor(user.id).setWish(oracleId, quantity);
    return Response.json({ oracleId, quantity });
  } catch (err) {
    return errorResponse(err);
  }
}
