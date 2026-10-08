import type { CachedResponse, ResponseCache } from "@/domain/ports/cache";

export class MemoryResponseCache implements ResponseCache {
  readonly entries = new Map<string, CachedResponse>();

  async get(key: string) {
    return this.entries.get(key) ?? null;
  }

  async set(key: string, value: CachedResponse) {
    this.entries.set(key, value);
  }
}
