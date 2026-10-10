import type { NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** "Me gusta" (POST) o quitarlo (DELETE) en el mazo de otro que puedes ver. */
async function setLike(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/like">, like: boolean) {
  try {
    const user = await requireUser(req);
    const id = (await ctx.params).id;
    const res = z.uuid().safeParse(id).success
      ? await getContainer().publicDecks.setLike(user.id, id, like)
      : null;
    if (!res) {
      return Response.json(
        {
          error: {
            code: "deck_not_found",
            message: "No puedes darle «me gusta» a ese mazo (no existe, es privado o es tuyo)",
          },
        },
        { status: 404 },
      );
    }
    return Response.json({ likes: res.likes, liked: like });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = (req: NextRequest, ctx: RouteContext<"/api/decks/[id]/like">) =>
  setLike(req, ctx, true);
export const DELETE = (req: NextRequest, ctx: RouteContext<"/api/decks/[id]/like">) =>
  setLike(req, ctx, false);
