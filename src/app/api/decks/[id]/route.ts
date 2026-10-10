import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { BRACKETS } from "@/domain/deck/bracket";
import { DECK_VISIBILITIES } from "@/domain/deck/visibility";
import { getContainer } from "@/server/container";
import { savedDeckDTO, type DeckViewDTO } from "@/server/dto";
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
    const [owner, likes, liked] = await Promise.all([
      c.social.byId(found.ownerId),
      c.publicDecks.likes(found.deck.id),
      user ? c.publicDecks.likedBy(user.id, [found.deck.id]) : Promise.resolve(new Set<string>()),
    ]);
    const body: DeckViewDTO = {
      ...savedDeckDTO(found.deck),
      isMine: user?.id === found.ownerId,
      owner: { username: owner?.username ?? null, name: owner?.name ?? "" },
      likes,
      liked: liked.has(found.deck.id),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z
  .object({
    visibility: z.enum(DECK_VISIBILITIES).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    targetBracket: z
      .union(BRACKETS.map((b) => z.literal(b)))
      .nullable()
      .optional(),
    inWishlist: z.boolean().optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), "Nada que cambiar");

/**
 * Cambia la visibilidad (público / oculto / privado), el nombre, el bracket objetivo o si entra en
 * la lista de deseos de uno de tus mazos.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/decks/[id]">) {
  try {
    const user = await requireUser(req);
    const id = parseId((await ctx.params).id);
    const changes = patchSchema.parse(await req.json());
    const decks = getContainer().decksFor(user.id);
    let ok = id !== null;
    if (ok && id && changes.visibility !== undefined)
      ok = await decks.setVisibility(id, changes.visibility);
    if (ok && id && changes.name !== undefined) ok = await decks.rename(id, changes.name);
    if (ok && id && changes.targetBracket !== undefined)
      ok = await decks.setTargetBracket(id, changes.targetBracket);
    if (ok && id && changes.inWishlist !== undefined)
      ok = await decks.setInWishlist(id, changes.inWishlist);
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
