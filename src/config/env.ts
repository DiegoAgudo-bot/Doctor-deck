import { z } from "zod";

/** Las variables vacías en .env ("FOO=") cuentan como no definidas. */
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SCRYFALL_DATA_DIR: z.string().default("./data/scryfall"),
  HTTP_USER_AGENT: z.string().min(1),
  SCRYFALL_MIN_INTERVAL_MS: z.coerce.number().int().min(100).default(100),
  EDHREC_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
  EDHREC_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),
  /** Intervalo mínimo entre peticiones a Archidekt / Moxfield. */
  DECK_SOURCES_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),

  // --- Usuarios (Better Auth) ---
  /** Secreto para firmar sesiones. Obligatorio en producción (≥ 32 caracteres aleatorios). */
  BETTER_AUTH_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(32).optional(),
  ),
  /** URL pública de la app, p. ej. https://deckdoctor.example.com (sin barra final). */
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  /** Login con Google: si faltan, el botón no aparece. */
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  /** SMTP para "olvidé mi contraseña", p. ej. smtps://usuario:clave@smtp.ejemplo.com:465. Si falta, no se ofrece. */
  SMTP_URL: optionalString,
  /** Remitente de los emails, p. ej. "Deck Doctor <no-reply@ejemplo.com>". */
  MAIL_FROM: z.string().default("Deck Doctor <no-reply@localhost>"),
});

export type Env = z.infer<typeof envSchema>;

/** Valida process.env. Solo debe usarse desde adaptadores, scripts o la capa app; nunca desde domain/. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuración inválida en .env:\n${z.prettifyError(parsed.error)}`);
  }
  if (source["NODE_ENV"] === "production" && !parsed.data.BETTER_AUTH_SECRET) {
    throw new Error("Falta BETTER_AUTH_SECRET en .env (obligatorio en producción).");
  }
  return parsed.data;
}
