import { connection, type NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { savedDeckDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

const notFound = () =>
  Response.json(
    { error: { code: "deck_not_found", message: "Ese mazo no existe" } },
    { status: 404 },
  );

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/decks/[id]">) {
  await connection();
  try {
    const user = await requireUser(req);
    const id = parseId((await ctx.params).id);
    const deck = id === null ? null : await getContainer().decksFor(user.id).get(id);
    return deck ? Response.json(savedDeckDTO(deck)) : notFound();
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
