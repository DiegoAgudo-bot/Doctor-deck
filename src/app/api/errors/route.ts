import { z } from "zod";
import { ERROR_LIMITS } from "@/domain/errors/report";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { clientIp, RateLimiter } from "@/server/rate-limit";
import { readJson } from "@/server/body";

const schema = z.object({
  message: z
    .string()
    .min(1)
    .max(ERROR_LIMITS.message * 2),
  stack: z
    .string()
    .max(ERROR_LIMITS.stack * 2)
    .nullish(),
  path: z
    .string()
    .max(ERROR_LIMITS.path * 2)
    .nullish(),
});

/** Por dirección y en total: un navegador con un error en bucle no llena el registro. */
const perClient = new RateLimiter(20, 60_000);
const overall = new RateLimiter(300, 60_000);

/**
 * Errores de JavaScript del navegador (`ErrorReporter`), al registro de /admin/errors. Público
 * (también pasan sin cuenta); no guarda quién era, solo la ruta y el navegador.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (!perClient.allow(ip) || !overall.allow("all")) return new Response(null, { status: 429 });
    const body = schema.parse(await readJson(request).catch(() => null));
    await getContainer().errorLog.record({
      source: "client",
      message: body.message,
      stack: body.stack ?? null,
      path: body.path ?? null,
      userAgent: request.headers.get("user-agent"),
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
