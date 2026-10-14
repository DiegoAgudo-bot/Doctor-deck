import type { NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import type { CardRoleEditDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { roleEditSchema, toRoleEdit } from "@/server/role-edits";
import { requireUser } from "@/server/session";
import { readJson } from "@/server/body";

/**
 * Corrige los roles y etiquetas de una carta solo en uno de mis mazos (mandan sobre las
 * correcciones de todos mis mazos). Sin roles ni etiquetas, se quita la de este mazo.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/decks/[id]/card-roles/[oracleId]">,
) {
  try {
    const user = await requireUser(req);
    const params = await ctx.params;
    const deckId = z.uuid().safeParse(params.id);
    const oracleId = z.string().min(1).max(64).parse(params.oracleId);
    const edit = toRoleEdit(roleEditSchema.parse(await readJson(req)));
    const ok =
      deckId.success &&
      (await getContainer().roleOverridesFor(user.id).setForDeck(deckId.data, oracleId, edit));
    if (!ok) {
      return Response.json(
        { error: { code: "deck_not_found", message: "Ese mazo no existe o no es tuyo" } },
        { status: 404 },
      );
    }
    const body: CardRoleEditDTO = {
      roles: edit.override?.roles ?? [],
      primary: edit.override?.primary ?? null,
      tags: edit.tags,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
