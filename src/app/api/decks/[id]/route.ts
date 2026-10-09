import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { savedDeckDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser, requireUser } from "@/server/session";

const notFound = () =>
  Response.json(
    { error: { code: "deck_not_found", message: "Ese mazo no existe o es privado" } },
    { status: 404 },
  );

/** Los mazos se identifican por su uuid público. */
const parseId = (raw: string): string | null => (z.uuid().safeParse(raw).success ? raw : null);

/** Un mazo: el tuyo, o el de otro si es público (también sin cuenta). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/decks/[id]">) {
  await connection();
  try {
    const user = await currentUser(req);
    const id = parseId((await ctx.params).id);
    const c = getContainer();
    const found = id === null ? null : await c.publicDecks.find(id, user?.id ?? null);
    if (!found) return notFound();
    const owner = await c.social.byId(found.ownerId);
    return Response.json({
      ...savedDeckDTO(found.deck),
      isMine: user?.id === found.ownerId,
      owner: { username: owner?.username ?? null, name: owner?.name ?? "" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z
  .object({ isPublic: z.boolean().optional(), name: z.string().trim().min(1).max(120).optional() })
  .refine((p) => p.isPublic !== undefined || p.name !== undefined, "Nada que cambiar");

/** Cambia la visibilidad (público / privado) o el nombre de uno de tus mazos. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/decks/[id]">) {
  try {
    const user = await requireUser(req);
    const id = parseId((await ctx.params).id);
    const changes = patchSchema.parse(await req.json());
    const decks = getContainer().decksFor(user.id);
    let ok = id !== null;
    if (ok && id && changes.isPublic !== undefined)
      ok = await decks.setPublic(id, changes.isPublic);
    if (ok && id && changes.name !== undefined) ok = await decks.rename(id, changes.name);
    return ok ? Response.json(changes) : notFound();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/decks/[id]">) {
  try {
    const user = await requireUser(req);
    const id = parseId((await ctx.params).id);
    const deleted = id !== null && (await getContainer().decksFor(user.id).delete(id));
    return deleted ? new Response(null, { status: 204 }) : notFound();
  } catch (err) {
    return errorResponse(err);
  }
}
