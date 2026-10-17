import { connection, type NextRequest } from "next/server";
import { cardDetailBody } from "@/server/card-page";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

/** Ficha de una carta (pública; con sesión, además mis copias y mi lista de deseos). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/cards/[oracleId]">) {
  await connection();
  try {
    const viewer = await currentUser(req);
    return Response.json(await cardDetailBody((await ctx.params).oracleId, viewer?.id ?? null));
  } catch (err) {
    return errorResponse(err);
  }
}
