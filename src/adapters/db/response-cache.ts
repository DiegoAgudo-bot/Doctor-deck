import type { CachedResponse, ResponseCache } from "@/domain/ports/cache";
import type { Db } from "./prisma";

/** Caché de respuestas HTTP en la tabla `HttpCache`. */
export class PrismaResponseCache implements ResponseCache {
  constructor(private readonly db: Db) {}

  async get(key: string) {
    const row = await this.db.httpCache.findUnique({ where: { url: key } });
    return row ? { body: row.body, fetchedAt: row.fetchedAt } : null;
  }

  async set(key: string, value: CachedResponse) {
    const data = { status: 200, body: value.body, fetchedAt: value.fetchedAt };
    await this.db.httpCache.upsert({
      where: { url: key },
      create: { url: key, ...data },
      update: data,
    });
  }
}
