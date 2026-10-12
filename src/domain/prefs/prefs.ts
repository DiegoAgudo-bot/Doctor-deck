/**
 * Preferencias de la interfaz que se guardan con la cuenta: filtros, orden y vista de cada página.
 * Cada clave guarda un objeto JSON pequeño; el servidor no sabe qué hay dentro (lo valida la
 * página que lo usa al leerlo).
 */
export const PREF_KEYS = ["cards", "collection"] as const;
export type PrefKey = (typeof PREF_KEYS)[number];

/** Tamaño máximo del JSON de una preferencia. */
export const PREF_MAX_CHARS = 4000;

export const isPrefKey = (k: string): k is PrefKey => (PREF_KEYS as readonly string[]).includes(k);

/** Lo que se puede guardar: un objeto (no array) que, en JSON, no pasa de `PREF_MAX_CHARS`. */
export function validPrefValue(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  try {
    return JSON.stringify(v).length <= PREF_MAX_CHARS;
  } catch {
    return false;
  }
}
