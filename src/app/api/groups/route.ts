import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { createGroup, myGroups } from "@/application/groups";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { groupSummaryDTO } from "@/server/social-dto";
import { readJson } from "@/server/body";

/** Mis grupos de juego. */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const groups = await myGroups(user.id, socialDeps());
    return Response.json(groups.map((g) => groupSummaryDTO(g, user.id)));
  } catch (err) {
    return errorResponse(err);
  }
}

const createSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
});

/** Crea un grupo (yo soy el dueño y primer miembro). Devuelve su id. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const id = await createGroup(user.id, createSchema.parse(await readJson(req)), socialDeps());
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
