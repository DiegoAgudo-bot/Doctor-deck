/** Nombre que se ve en títulos, vistas previas y datos estructurados. */
export const SITE_NAME = "Doctor Deck";

/** Dominio público de producción (si `BETTER_AUTH_URL` no está, p. ej. durante el build). */
const DEFAULT_SITE_URL = "https://doctordeck.app";

/**
 * URL pública de la web para metadatos (canónicas, vistas previas) que se calculan también en el
 * build, donde `loadEnv` no se puede usar (exige el secreto de sesiones en producción).
 */
export function publicSiteUrl(source: Record<string, string | undefined> = process.env): URL {
  try {
    return new URL(source["BETTER_AUTH_URL"] || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}
