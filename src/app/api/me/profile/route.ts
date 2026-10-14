import { connection } from "next/server";
import { z } from "zod";
import { ensureUsername, updateProfile } from "@/application/social";
import { getContainer } from "@/server/container";
import { publicProfileDTO, type MyProfileDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { readJson } from "@/server/body";
import { NOTIFICATION_GROUP_KEYS } from "@/domain/social/notification-prefs";

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
      mutedNotifications: await social.mutedNotifications(user.id),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  username: z.string().max(40).optional(),
  collectionPublic: z.boolean().optional(),
  tradesPublic: z.boolean().optional(),
  /** null = sin avisos de precio. */
  priceAlertPercent: z.number().int().min(5).max(90).nullable().optional(),
  mutedNotifications: z.array(z.enum(NOTIFICATION_GROUP_KEYS)).max(20).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const { priceAlertPercent, tradesPublic, mutedNotifications, ...changes } = schema.parse(
      await readJson(request),
    );
    const social = getContainer().social;
    if (tradesPublic !== undefined) await social.setTradesPublic(user.id, tradesPublic);
    if (mutedNotifications !== undefined)
      await social.setMutedNotifications(user.id, mutedNotifications);
    if (priceAlertPercent !== undefined)
      await social.setPriceAlertPercent(user.id, priceAlertPercent);
    const profile = await updateProfile(user.id, changes, { profiles: social });
    const body: MyProfileDTO = {
      ...publicProfileDTO(profile),
      email: user.email,
      priceAlertPercent: await social.priceAlertPercent(user.id),
      mutedNotifications: await social.mutedNotifications(user.id),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
