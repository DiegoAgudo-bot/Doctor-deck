/**
 * Caché en memoria de cálculos caros por clave (p. ej. la colección de un usuario). Una entrada vale
 * mientras no cambie la época de los datos (`dataEpoch`: cualquier escritura en la colección, los
 * mazos, préstamos, roles o el catálogo) y no pase `ttlMs` (lo que cambia otro proceso, como los
 * precios de `scryfall:sync`). Las peticiones simultáneas con la misma clave comparten el cálculo.
 */
export class MemoCache<T> {
  private readonly entries = new Map<
    string,
    { epoch: number | string; at: number; value: Promise<T> }
  >();

  constructor(
    /** Época de los datos de esa clave (p. ej. la del usuario de la clave). */
    private readonly epoch: (key: string) => number | string,
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
    const epoch = this.epoch(key);
    const hit = this.entries.get(key);
    if (hit && hit.epoch === epoch && this.now() - hit.at < this.ttlMs) {
      // Al final del Map: la usada más recientemente.
      this.entries.delete(key);
      this.entries.set(key, hit);
      return { value: await hit.value, hit: true };
    }
    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { epoch, at: this.now(), value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    try {
      return { value: await value, hit: false };
    } catch (err) {
      // Un fallo no se queda en la caché.
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw err;
    }
  }
}
