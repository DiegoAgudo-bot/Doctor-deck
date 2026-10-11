import { connection, type NextRequest } from "next/server";
import { invitePreview, joinGroup } from "@/application/groups";
import { errorResponse } from "@/server/http";
import { currentUser, requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { groupSummaryDTO } from "@/server/social-dto";

/** Lo que se ve con el enlace de invitación (también sin cuenta). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/groups/join/[code]">) {
  await connection();
  try {
    const user = await currentUser(req);
    const { group, member } = await invitePreview(
      (await ctx.params).code,
      user?.id ?? null,
      socialDeps(),
    );
    return Response.json({ group: groupSummaryDTO(group, user?.id ?? null), member });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Entrar en el grupo. Devuelve su id. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/groups/join/[code]">) {
  try {
    const user = await requireUser(req);
    const id = await joinGroup((await ctx.params).code, user.id, socialDeps());
    return Response.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}
