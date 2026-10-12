/** Un error para el registro de /admin/errors (del servidor o del navegador). */
export interface ErrorReport {
  source: "server" | "client";
  message: string;
  stack?: string | null | undefined;
  /** Ruta de la página o de la API donde pasó (sin parámetros). */
  path?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export const ERROR_LIMITS = { message: 500, stack: 4000, path: 300, userAgent: 300 } as const;

const cut = (s: string | null | undefined, n: number) =>
  s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null;

/** Recorta cada campo a su máximo y quita la query de la ruta (puede llevar datos). */
export function cleanReport(r: ErrorReport): ErrorReport {
  return {
    source: r.source,
    message: cut(r.message.trim() || "(sin mensaje)", ERROR_LIMITS.message) ?? "",
    stack: cut(r.stack, ERROR_LIMITS.stack),
    path: cut(r.path?.split(/[?#]/)[0], ERROR_LIMITS.path),
    userAgent: cut(r.userAgent, ERROR_LIMITS.userAgent),
  };
}

/**
 * Huella para agrupar: el mismo error con otros números o ids (uuid, ids de mazo…) es el mismo.
 * Las rutas también: /decks/<uuid> → /decks/:id.
 */
export function errorFingerprint(r: ErrorReport): string {
  const norm = (s: string) =>
    s
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\d+/g, "N");
  return `${r.source}|${norm(r.path ?? "")}|${norm(r.message)}`.slice(0, 900);
}
