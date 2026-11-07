"use client";

import { createAuthClient } from "better-auth/react";
import type { Locale } from "@/domain/i18n/locale";
import { internalPath } from "@/domain/security/internal-path";

/** Cliente de Better Auth (usa /api/auth del mismo origen). */
export const authClient = createAuthClient();

const MESSAGES_EN: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Wrong email or password.",
  INVALID_EMAIL: "That email isn't valid.",
  INVALID_PASSWORD: "Wrong password.",
  PASSWORD_TOO_SHORT: "The password must be at least 8 characters long.",
  PASSWORD_TOO_LONG: "The password is too long.",
  USER_ALREADY_EXISTS:
    "There's already an account with that email. Sign in or reset your password.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "There's already an account with that email. Sign in or reset your password.",
  INVALID_TOKEN: "The link isn't valid or has already been used. Ask for another one.",
  TOKEN_EXPIRED: "The link has expired. Ask for another one.",
  USER_NOT_FOUND: "There's no account with that email.",
};

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

/** Mensaje para un error de Better Auth, en español o en inglés. */
export function authErrorMessage(
  error: { code?: string | undefined; status?: number; message?: string | undefined } | null,
  locale: Locale = "es",
): string {
  const en = locale === "en";
  const messages = en ? MESSAGES_EN : MESSAGES;
  if (!error) return en ? "Something went wrong." : "Ha ocurrido un error.";
  if (error.code && messages[error.code]) return messages[error.code] as string;
  if (error.status === 429)
    return en
      ? "Too many attempts. Wait a minute and try again."
      : "Demasiados intentos. Espera un minuto y vuelve a probar.";
  return en
    ? "Couldn't complete it. Please try again."
    : "No se ha podido completar. Inténtalo de nuevo.";
}

/** Solo rutas internas como destino tras entrar (evita redirecciones a otros dominios). */
export function safeNext(next: string | null, fallback = "/analyze"): string {
  return internalPath(next) ?? fallback;
}
