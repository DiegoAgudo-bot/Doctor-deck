import { connection } from "next/server";
import { getContainer } from "@/server/container";
import type { CardRoleEditDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mis correcciones de roles y etiquetas, como pares [oracleId, corrección]. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const edits = await getContainer().roleOverridesFor(user.id).all();
    const body: [string, CardRoleEditDTO][] = [...edits].map(([id, e]) => [
      id,
      { roles: e.override?.roles ?? [], primary: e.override?.primary ?? null, tags: e.tags },
    ]);
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
