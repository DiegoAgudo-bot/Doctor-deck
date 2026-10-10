import { archidektDeckSource } from "@/adapters/deck-sources/archidekt";
import { moxfieldDeckSource } from "@/adapters/deck-sources/moxfield";
import { textDeckSource } from "@/adapters/deck-sources/text-deck-source";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository, PrismaPublicDecks } from "@/adapters/db/deck-repository";
import { PrismaPriceHistory } from "@/adapters/db/price-history";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { PrismaResponseCache } from "@/adapters/db/response-cache";
import { EdhrecClient } from "@/adapters/edhrec/edhrec-client";
import { createDb } from "@/adapters/db/prisma";
import { HttpClient } from "@/adapters/http/http-client";
import { FileImageCache } from "@/adapters/images/image-cache";
import { smtpMailer } from "@/adapters/mail/mailer";
import { engineConfig } from "@/config/engine";
import { loadEnv } from "@/config/env";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { authFeatures, createAuth, type Auth } from "./auth";

export type Container = ReturnType<typeof createContainer>;

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
  const deckSourcesHttp = new HttpClient({
    userAgent: env.HTTP_USER_AGENT,
    minIntervalMs: env.DECK_SOURCES_MIN_INTERVAL_MS,
  });
  const mailer = env.SMTP_URL ? smtpMailer(env.SMTP_URL, env.MAIL_FROM) : null;
  return {
    env,
    edhrec,
    db,
    mailer,
    authFeatures: authFeatures(env, mailer),
    /** Catálogo de cartas: compartido por todos los usuarios. */
    cards: new PrismaCardRepository(db),
    /** Colección y mazos: siempre de un usuario concreto. */
    collectionFor: (userId: string) => new PrismaCollectionRepository(db, userId),
    decksFor: (userId: string) => new PrismaDeckRepository(db, userId),
    /** Parte social: perfiles, seguidores y notificaciones (un mismo adaptador). */
    social: new PrismaSocialRepository(db),
    publicDecks: new PrismaPublicDecks(db),
    /** Precio de cada día de las cartas en colecciones y mazos (lo rellena `scryfall:sync`). */
    prices: new PrismaPriceHistory(db),
    deckSources: [
      archidektDeckSource(deckSourcesHttp),
      moxfieldDeckSource(deckSourcesHttp),
      textDeckSource,
    ],
    classifier: new HeuristicRoleClassifier(),
    engineConfig,
    scryfallHttp: new HttpClient({
      userAgent: env.HTTP_USER_AGENT,
      minIntervalMs: env.SCRYFALL_MIN_INTERVAL_MS,
    }),
    /** Imágenes de cartas: de disco o de cards.scryfall.io (que no tiene límite de peticiones). */
    images: new FileImageCache(
      env.IMAGE_CACHE_DIR,
      env.IMAGE_CACHE_MAX_MB * 1024 * 1024,
      new HttpClient({ userAgent: env.HTTP_USER_AGENT, minIntervalMs: 0, accept: "image/*" }),
    ),
  };
}

const globalForContainer = globalThis as unknown as {
  deckDoctorContainer?: Container;
  deckDoctorAuth?: Auth;
};

/** Instancia única para el servidor web (sobrevive al recargado en caliente de `next dev`). */
export function getContainer(): Container {
  globalForContainer.deckDoctorContainer ??= createContainer();
  return globalForContainer.deckDoctorContainer;
}

/** Better Auth sobre la misma BD que el resto de la app. */
export function getAuth(): Auth {
  const c = getContainer();
  globalForContainer.deckDoctorAuth ??= createAuth({ db: c.db, env: c.env, mailer: c.mailer });
  return globalForContainer.deckDoctorAuth;
}
