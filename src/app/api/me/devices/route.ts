import { z } from "zod";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

const registerSchema = z.object({
  /** Token de Firebase Cloud Messaging del móvil. */
  token: z.string().min(10).max(4096),
  platform: z.enum(["android", "ios"]),
  appVersion: z.string().max(32).optional(),
});

/** La app registra el móvil para recibir notificaciones push (al entrar y al abrirse). */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { token, platform, appVersion } = registerSchema.parse(await request.json());
    await getContainer().pushDevices.register(user.id, {
      token,
      platform,
      appVersion: appVersion ?? null,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Al cerrar sesión en la app: deja de mandar push a ese móvil. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const { token } = z.object({ token: z.string().min(1).max(4096) }).parse(await request.json());
    await getContainer().pushDevices.unregister(user.id, token);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
