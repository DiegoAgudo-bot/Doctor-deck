import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaResponseCache } from "@/adapters/db/response-cache";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { createDb } from "@/adapters/db/prisma";
import { HttpClient } from "@/adapters/http/http-client";
import { loadEnv } from "@/config/env";

/** Raíz de composición: une configuración + adaptadores concretos. Solo para servidor y scripts. */
export function createContainer() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  const edhrec = new EdhrecClient({
    http: new HttpClient({
      userAgent: env.HTTP_USER_AGENT,
      minIntervalMs: env.EDHREC_MIN_INTERVAL_MS,
    }),
    cache: new PrismaResponseCache(db),
    ttlMs: env.EDHREC_CACHE_TTL_HOURS * 3_600_000,
  });
  return {
    env,
    edhrec,
    db,
    cards: new PrismaCardRepository(db),
    collection: new PrismaCollectionRepository(db),
    deckSources: [textDeckSource],
    scryfallHttp: new HttpClient({
      userAgent: env.HTTP_USER_AGENT,
      minIntervalMs: env.SCRYFALL_MIN_INTERVAL_MS,
    }),
  };
}
