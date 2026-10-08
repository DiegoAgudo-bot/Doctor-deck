import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Acceso con una única contraseña (`APP_PASSWORD`). Sin ella la app queda abierta (desarrollo local).
 * La sesión es una cookie con un HMAC derivado de la contraseña: no hay estado en el servidor y
 * cambiar la contraseña cierra todas las sesiones.
 */
export const SESSION_COOKIE = "dd_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 365;

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export function appPassword(source: Record<string, string | undefined> = process.env) {
  const p = source["APP_PASSWORD"];
  return p ? p : null;
}

export function sessionToken(password: string): string {
  return createHmac("sha256", password).update("deck-doctor-session-v1").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isValidSession(cookie: string | undefined, password: string): boolean {
  return cookie !== undefined && safeEqual(cookie, sessionToken(password));
}

export function checkPassword(candidate: string, password: string): boolean {
  // Compara los HMAC (misma longitud) para no filtrar la longitud de la contraseña.
  return safeEqual(sessionToken(candidate), sessionToken(password));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/** Destino tras el login: solo rutas internas (evita redirecciones abiertas a otro dominio). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
