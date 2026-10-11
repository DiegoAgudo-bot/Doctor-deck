import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { gameStats } from "@/application/games";
import { deleteGroup, memberGroup, newInvite, updateGroup } from "@/application/groups";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { groupDTO } from "@/server/social-dto";

async function view(groupId: string, userId: string) {
  const deps = socialDeps();
  const group = await memberGroup(groupId, userId, deps);
  return groupDTO(group, userId, await gameStats({ groupId }, deps));
}

/** Un grupo (solo para sus miembros): miembros, enlace de invitación, clasificación y partidas. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/[id]">) {
  await connection();
  try {
    const user = await requireUser(req);
    return Response.json(await view((await ctx.params).id, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  /** true = enlace de invitación nuevo (el anterior deja de valer). */
  newInvite: z.boolean().optional(),
});

/** Cambiar nombre, descripción o enlace (solo el dueño). */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/groups/[id]">) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const deps = socialDeps();
    if (body.name !== undefined || body.description !== undefined) {
      await updateGroup(id, user.id, body, deps);
    }
    if (body.newInvite) await newInvite(id, user.id, deps);
    return Response.json(await view(id, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Borrar el grupo (solo el dueño; con sus partidas). */
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/groups/[id]">) {
  try {
    const user = await requireUser(req);
    await deleteGroup((await ctx.params).id, user.id, socialDeps());
    return Response.json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
