import type { NextRequest } from "next/server";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Solo rutas de la propia web: `/trades`, `/groups/x?tab=y`… (nunca `//otro.com`). */
const safePath = (next: string | null) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";

/**
 * Puente de la app móvil a la web: la app abre esta URL en su WebView mandando su cookie de sesión
 * en la cabecera (el WebView no la tiene) y aquí se le devuelve como cookie del WebView antes de
 * redirigir a `next`. Así las páginas que la app no tiene en nativo (intercambios, grupos…) se
 * abren con la sesión. Solo copia cookies de sesión válidas de quien las manda.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const secure = request.nextUrl.protocol === "https:";
    const headers = new Headers({ Location: safePath(request.nextUrl.searchParams.get("next")) });
    for (const part of (request.headers.get("cookie") ?? "").split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (!name || !/^(__Secure-)?better-auth\./.test(name)) continue;
      headers.append(
        "Set-Cookie",
        `${name}=${rest.join("=")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure ? "; Secure" : ""}`,
      );
    }
    return new Response(null, { status: 302, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
