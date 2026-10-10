import type { NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import type { CardRoleEditDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { roleEditSchema, toRoleEdit } from "@/server/role-edits";
import { requireUser } from "@/server/session";

/**
 * Corrige los roles y etiquetas de una carta (para todos mis mazos). Sin roles ni etiquetas,
 * vuelve a los automáticos.
 */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/me/card-roles/[oracleId]">) {
  try {
    const user = await requireUser(req);
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse((await ctx.params).oracleId);
    const edit = toRoleEdit(roleEditSchema.parse(await req.json()));
    await getContainer().roleOverridesFor(user.id).set(oracleId, edit);
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
