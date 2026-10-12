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
