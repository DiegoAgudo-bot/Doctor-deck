import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { addComment, deckComments, setCommentsOpen } from "@/application/comments";
import { errorResponse } from "@/server/http";
import { currentUser, requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { deckCommentsDTO } from "@/server/social-dto";

/** Comentarios de un mazo público u oculto (también sin cuenta). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/comments">) {
  await connection();
  try {
    const user = await currentUser(req);
    const view = await deckComments((await ctx.params).id, user?.id ?? null, socialDeps());
    return Response.json(deckCommentsDTO(view));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Comentar. Devuelve los comentarios actualizados. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/comments">) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const { body } = z.object({ body: z.string().max(5000) }).parse(await req.json());
    const deps = socialDeps();
    await addComment(user.id, id, body, deps);
    return Response.json(deckCommentsDTO(await deckComments(id, user.id, deps)), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Abrir o cerrar los comentarios de mi mazo. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/comments">) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const { open } = z.object({ open: z.boolean() }).parse(await req.json());
    const deps = socialDeps();
    await setCommentsOpen(user.id, id, open, deps);
    return Response.json(deckCommentsDTO(await deckComments(id, user.id, deps)));
  } catch (err) {
    return errorResponse(err);
  }
}
