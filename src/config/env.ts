import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SCRYFALL_DATA_DIR: z.string().default("./data/scryfall"),
  HTTP_USER_AGENT: z.string().min(1),
  SCRYFALL_MIN_INTERVAL_MS: z.coerce.number().int().min(100).default(100),
  EDHREC_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
  EDHREC_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),
});

export type Env = z.infer<typeof envSchema>;

/** Valida process.env. Solo debe usarse desde adaptadores, scripts o la capa app; nunca desde domain/. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuración inválida en .env:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
