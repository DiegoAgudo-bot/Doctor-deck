/**
 * Tiempos por paso de una petición, para la cabecera `Server-Timing` (se ven en las herramientas de
 * desarrollo del navegador, pestaña Red): así se sabe dónde se va el tiempo en producción.
 */
export class Timing {
  private readonly parts: string[] = [];

  async step<T>(name: string, f: () => Promise<T>, desc?: string): Promise<T> {
    const start = performance.now();
    try {
      return await f();
    } finally {
      this.add(name, performance.now() - start, desc);
    }
  }

  add(name: string, ms: number, desc?: string) {
    this.parts.push(`${name};dur=${ms.toFixed(1)}${desc ? `;desc="${desc}"` : ""}`);
  }

  /**
   * Envuelve un adaptador para cronometrar sus métodos asíncronos (`edhrec.getCommander`…). Se
   * suman las llamadas repetidas al mismo método.
   */
  wrap<T extends object>(name: string, target: T): T {
    return new Proxy(target, {
      get: (obj, prop, receiver) => {
        const value: unknown = Reflect.get(obj, prop, receiver);
        if (typeof value !== "function" || typeof prop !== "string") return value;
        return (...args: unknown[]) => {
          const start = performance.now();
          const result: unknown = (value as (...a: unknown[]) => unknown).apply(obj, args);
          if (!(result instanceof Promise)) return result;
          return result.finally(() => this.sum(`${name}.${prop}`, performance.now() - start));
        };
      },
    });
  }

  private readonly sums = new Map<string, number>();
  private sum(name: string, ms: number) {
    this.sums.set(name, (this.sums.get(name) ?? 0) + ms);
  }

  header(): Record<string, string> {
    for (const [name, ms] of this.sums) this.add(name.replace(/[^\w.-]/g, "_"), ms);
    this.sums.clear();
    return this.parts.length ? { "Server-Timing": this.parts.join(", ") } : {};
  }
}
