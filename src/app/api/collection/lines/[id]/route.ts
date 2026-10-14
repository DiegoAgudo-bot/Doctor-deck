import type { NextRequest } from "next/server";
import { z } from "zod";
import { editCollectionLine } from "@/application/collection-cards";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { readJson } from "@/server/body";

type Ctx = RouteContext<"/api/collection/lines/[id]">;

const notFound = () =>
  Response.json(
    { error: { code: "not_found", message: "Esa línea no está en tu colección" } },
    { status: 404 },
  );

const patchSchema = z.object({
  /** 0 = quitarla. */
  quantity: z.number().int().min(0).max(999).optional(),
  foil: z.boolean().optional(),
  language: z.string().min(1).max(40).nullable().optional(),
  condition: z.string().min(1).max(40).nullable().optional(),
  scryfallId: z.uuid().optional(),
});

/**
 * Cambia una línea de mi colección (copias, foil, idioma, estado o edición), también las del
 * CSV: pasan a ser "a mano" para que reimportar no las pise.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return notFound();
    const c = getContainer();
    const ok = await editCollectionLine(id.data, patchSchema.parse(await readJson(req)), {
      cards: c.cards,
      collection: c.collectionFor(user.id),
    });
    return ok ? new Response(null, { status: 204 }) : notFound();
  } catch (err) {
    return errorResponse(err);
  }
}

/** Quita una línea de mi colección (también las del CSV). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return notFound();
    const ok = await getContainer().collectionFor(user.id).removeLine(id.data);
    return ok ? new Response(null, { status: 204 }) : notFound();
  } catch (err) {
    return errorResponse(err);
  }
}
