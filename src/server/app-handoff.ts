import { randomBytes } from "node:crypto";

/**
 * Códigos de un solo uso para pasar la sesión de la app móvil a su WebView: la app (con su cookie
 * en la cabecera) pide un código y el WebView abre `/api/app/web?code=…`, que pone la cookie y
 * redirige. Viven en memoria 60 s (un solo contenedor) y se borran al usarlos.
 */
const TTL_MS = 60_000;
const codes = new Map<string, { cookies: string[]; expires: number }>();

export function createHandoff(cookies: string[], now = Date.now()): string {
  for (const [k, v] of codes) if (v.expires < now) codes.delete(k);
  const code = randomBytes(24).toString("base64url");
  codes.set(code, { cookies, expires: now + TTL_MS });
  return code;
}

export function takeHandoff(code: string, now = Date.now()): string[] | null {
  const entry = codes.get(code);
  codes.delete(code);
  return entry && entry.expires >= now ? entry.cookies : null;
}

/** Las cookies de sesión de Better Auth de una cabecera Cookie (`nombre=valor`). */
export const sessionCookies = (header: string | null) =>
  (header ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter((p) => /^(__Secure-)?better-auth\.[\w.-]+=/.test(p));
