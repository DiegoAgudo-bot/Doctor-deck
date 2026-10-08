import { z } from "zod";
import type { ApiErrorBody } from "@/server/dto";
import {
  appPassword,
  checkPassword,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  sessionToken,
} from "@/server/auth";

const bodySchema = z.object({ password: z.string() });

export async function POST(request: Request) {
  const password = appPassword();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!password || !parsed.success || !checkPassword(parsed.data.password, password)) {
    // Pequeña espera para frenar los intentos por fuerza bruta.
    await new Promise((r) => setTimeout(r, 1000));
    const body: ApiErrorBody = {
      error: { code: "invalid_password", message: "Contraseña incorrecta" },
    };
    return Response.json(body, { status: 401 });
  }

  const secure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  const cookie = [
    `${SESSION_COOKIE}=${sessionToken(password)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_S}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
