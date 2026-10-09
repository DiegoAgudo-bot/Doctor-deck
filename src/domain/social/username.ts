/**
 * Nombres de usuario públicos (perfil /u/{username}): 3–20 caracteres, minúsculas, números y "_",
 * empezando por letra. Algunos están reservados porque chocarían con rutas o confundirían.
 */
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

const RESERVED = new Set([
  "admin",
  "administrador",
  "api",
  "ajustes",
  "coleccion",
  "comunidad",
  "deckdoctor",
  "decks",
  "entrar",
  "mazo",
  "mazos",
  "me",
  "notificaciones",
  "registro",
  "root",
  "soporte",
  "support",
  "usuario",
  "usuarios",
]);

export type UsernameProblem = "format" | "reserved";

/** null si es válido; si no, el motivo. Se valida ya en minúsculas. */
export function usernameProblem(username: string): UsernameProblem | null {
  if (!USERNAME_RE.test(username)) return "format";
  if (RESERVED.has(username)) return "reserved";
  return null;
}

export const USERNAME_HELP =
  "De 3 a 20 caracteres: letras minúsculas sin tildes, números y _, empezando por letra.";

/** Base para un nombre de usuario a partir del nombre o, si no sirve, del email. */
export function usernameBase(name: string, email: string): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+/, "")
      .replace(/_+$/, "")
      .slice(0, 16);
  for (const candidate of [slug(name), slug(email.split("@")[0] ?? "")]) {
    const base = candidate.length >= 3 ? candidate : "";
    if (base && !usernameProblem(base)) return base;
  }
  return "jugador";
}

/** Candidatos en orden: la base y luego con sufijos numéricos (base2, base3…). */
export function* usernameCandidates(base: string): Generator<string> {
  yield base;
  for (let i = 2; i < 10_000; i++) yield `${base.slice(0, 20 - String(i).length)}${i}`;
}
