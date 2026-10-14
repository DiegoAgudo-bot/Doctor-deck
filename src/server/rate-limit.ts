import { AppError } from "@/application/errors";

/**
 * Límite sencillo en memoria: como mucho `max` usos por clave en cada ventana de `windowMs`.
 * Para endpoints públicos baratos (p. ej. el registro de errores del navegador).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { start: number; n: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || t - h.start >= this.windowMs) {
      if (this.hits.size > 10_000) this.hits.clear();
      this.hits.set(key, { start: t, n: 1 });
      return true;
    }
    h.n += 1;
    return h.n <= this.max;
  }
}

/**
 * La IP del cliente. Detrás de Traefik, el último valor de `X-Forwarded-For` es el que ha visto
 * el proxy (los anteriores los puede inventar el cliente).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",");
  return forwarded?.[forwarded.length - 1]?.trim() || "?";
}

/** Por usuario si hay sesión; si no, por IP. */
export const clientKey = (request: Request, userId?: string | null) =>
  userId ? `u:${userId}` : `ip:${clientIp(request)}`;

/**
 * Límites de las rutas que cuestan (llaman a servicios externos o calculan mucho): por minuto y
 * cliente. Generosos para un uso normal; frenan bucles que harían que nos bloqueen fuera.
 */
export const routeLimits = {
  analyze: new RateLimiter(60, 60_000),
  combos: new RateLimiter(60, 60_000),
  newDeck: new RateLimiter(15, 60_000),
  staples: new RateLimiter(60, 60_000),
  importCollection: new RateLimiter(10, 60_000),
  importShared: new RateLimiter(30, 60_000),
  /** Imágenes que no tenemos y hay que pedir fuera (las guardadas no cuentan). */
  imageFetch: new RateLimiter(300, 60_000),
};

/** Lanza 429 si ese cliente ha pasado el límite. */
export function enforceLimit(limiter: RateLimiter, key: string) {
  if (!limiter.allow(key)) {
    throw new AppError("rate_limited", "Vas muy rápido: espera un minuto y vuelve a probar.", 429);
  }
}
