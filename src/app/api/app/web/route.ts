import type { NextRequest } from "next/server";
import { internalPath } from "@/domain/security/internal-path";
import { createHandoff, sessionCookies, takeHandoff } from "@/server/app-handoff";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Solo rutas de la propia web: `/trades`, `/groups/x?tab=y`… (nunca `//otro.com`). */
const safePath = (next: string | null) => internalPath(next) ?? "/";

/**
 * Cabecera que solo pone el WebView de la app al abrir el puente. Un enlace o una redirección
 * desde otra web no pueden añadirla, así que nadie puede meter a otra persona en su cuenta
 * mandándole un enlace con su propio código.
 */
const APP_BRIDGE_HEADER = "x-doctordeck-app";

/**
 * Puente de la app móvil a la web (las páginas que la app no tiene en nativo: intercambios,
 * grupos…). 1) La app, con su sesión en la cabecera, pide aquí un código de un solo uso (60 s).
 * 2) Su WebView abre `GET ?code=…&next=/ruta`, que le pone la cookie de sesión y redirige. Así no
 * hace falta mandar la cookie en las cabeceras del WebView (Android no siempre las respeta). El
 * paso 2 exige `APP_BRIDGE_HEADER`.
 */
export async function POST(request: Request) {
  try {
    await requireUser(request);
    const cookies = sessionCookies(request.headers.get("cookie"));
    return Response.json({ code: createHandoff(cookies) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safePath(params.get("next"));
  const fromApp = request.headers.get(APP_BRIDGE_HEADER) === "1";
  const cookies = fromApp ? takeHandoff(params.get("code") ?? "") : null;
  if (!cookies) {
    // Código caducado o ya usado: que entre en la web (y vuelva a donde iba).
    return new Response(null, {
      status: 302,
      headers: { Location: `/login?next=${encodeURIComponent(next)}` },
    });
  }
  const secure = request.nextUrl.protocol === "https:";
  const headers = new Headers({ Location: next });
  for (const c of cookies) {
    headers.append(
      "Set-Cookie",
      `${c}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure ? "; Secure" : ""}`,
    );
  }
  return new Response(null, { status: 302, headers });
}
