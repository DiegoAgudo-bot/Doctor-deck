import { connection } from "next/server";
import { getContainer } from "@/server/container";
import type { AppInfoDTO } from "@/server/dto";

/**
 * Lo que la app móvil consulta al abrirse: versión mínima (si la suya es anterior, pide
 * actualizar) y qué hay disponible en este servidor.
 */
export async function GET() {
  await connection();
  const c = getContainer();
  const body: AppInfoDTO = {
    minVersion: c.env.MOBILE_MIN_VERSION,
    push: c.pushEnabled,
    google: c.authFeatures.google,
    passwordReset: c.authFeatures.passwordReset,
  };
  return Response.json(body);
}
