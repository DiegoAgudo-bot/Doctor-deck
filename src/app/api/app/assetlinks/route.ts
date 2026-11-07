import { connection } from "next/server";
import { getContainer } from "@/server/container";

/**
 * Digital Asset Links (`/.well-known/assetlinks.json`, por el rewrite de next.config.ts): dice a
 * Android que la app `app.doctordeck` puede abrir los enlaces de este dominio sin preguntar.
 * Las huellas SHA-256 de los certificados (la de firma de apps de Google Play y, si se instala
 * a mano, la de subida) van en `ANDROID_CERT_SHA256`. Sin ellas, lista vacía: los enlaces se
 * siguen abriendo, pero Android pregunta con qué.
 */
export async function GET() {
  await connection();
  const fingerprints = getContainer().env.ANDROID_CERT_SHA256;
  const body =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "app.doctordeck",
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
