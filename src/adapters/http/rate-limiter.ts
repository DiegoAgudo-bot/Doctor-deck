export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Garantiza un intervalo mínimo entre llamadas consecutivas, incluso si se lanzan en paralelo. */
export class RateLimiter {
  private next = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly minIntervalMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const slot = this.queue.then(async () => {
      const wait = this.next - this.clock.now();
      if (wait > 0) await this.clock.sleep(wait);
      this.next = this.clock.now() + this.minIntervalMs;
    });
    this.queue = slot.catch(() => undefined);
    return slot.then(task);
  }
}
