"use client";

import { createAuthClient } from "better-auth/react";

/** Cliente de Better Auth (usa /api/auth del mismo origen). */
export const authClient = createAuthClient();

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email o contraseña incorrectos.",
  INVALID_EMAIL: "El email no es válido.",
  INVALID_PASSWORD: "Contraseña incorrecta.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese email. Entra o recupera la contraseña.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Ya existe una cuenta con ese email. Entra o recupera la contraseña.",
  INVALID_TOKEN: "El enlace no es válido o ya se ha usado. Pide otro.",
  TOKEN_EXPIRED: "El enlace ha caducado. Pide otro.",
  USER_NOT_FOUND: "No hay ninguna cuenta con ese email.",
};

/** Mensaje en español para un error de Better Auth. */
export function authErrorMessage(
  error: { code?: string | undefined; status?: number; message?: string | undefined } | null,
): string {
  if (!error) return "Ha ocurrido un error.";
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code] as string;
  if (error.status === 429) return "Demasiados intentos. Espera un minuto y vuelve a probar.";
  return "No se ha podido completar. Inténtalo de nuevo.";
}

/** Solo rutas internas como destino tras entrar (evita redirecciones a otros dominios). */
export function safeNext(next: string | null, fallback = "/mazo"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
