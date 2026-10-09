import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Comprobación optimista: si no hay cookie de sesión, a /entrar. La comprobación real (sesión válida
 * y dueño de los datos) la hace cada ruta de la API con `requireUser`. Analizar mazos e importar la
 * colección (al navegador) no exige cuenta; solo los mazos guardados.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/entrar", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/mazos", "/notificaciones", "/ajustes"],
};
