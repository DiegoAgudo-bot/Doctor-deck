import { connection } from "next/server";
import { z } from "zod";
import { ensureUsername, updateProfile } from "@/application/social";
import { getContainer } from "@/server/container";
import { publicProfileDTO, type MyProfileDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mi perfil: nombre de usuario (se genera si aún no hay) y si la colección es pública. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const profile = await ensureUsername(user.id, { profiles: getContainer().social });
    const body: MyProfileDTO = { ...publicProfileDTO(profile), email: user.email };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  username: z.string().max(40).optional(),
  collectionPublic: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const changes = schema.parse(await request.json());
    const profile = await updateProfile(user.id, changes, { profiles: getContainer().social });
    const body: MyProfileDTO = { ...publicProfileDTO(profile), email: user.email };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
