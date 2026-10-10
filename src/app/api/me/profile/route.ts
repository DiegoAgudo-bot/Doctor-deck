import { connection } from "next/server";
import { z } from "zod";
import { ensureUsername, updateProfile } from "@/application/social";
import { getContainer } from "@/server/container";
import { publicProfileDTO, type MyProfileDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mi perfil: nombre de usuario (se genera si aún no hay), colección pública y avisos de precio. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const social = getContainer().social;
    const profile = await ensureUsername(user.id, { profiles: social });
    const body: MyProfileDTO = {
      ...publicProfileDTO(profile),
      email: user.email,
      priceAlertPercent: await social.priceAlertPercent(user.id),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  username: z.string().max(40).optional(),
  collectionPublic: z.boolean().optional(),
  /** null = sin avisos de precio. */
  priceAlertPercent: z.number().int().min(5).max(90).nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const { priceAlertPercent, ...changes } = schema.parse(await request.json());
    const social = getContainer().social;
    if (priceAlertPercent !== undefined)
      await social.setPriceAlertPercent(user.id, priceAlertPercent);
    const profile = await updateProfile(user.id, changes, { profiles: social });
    const body: MyProfileDTO = {
      ...publicProfileDTO(profile),
      email: user.email,
      priceAlertPercent: await social.priceAlertPercent(user.id),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
