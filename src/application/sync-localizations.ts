import {
  betterLocalization,
  deriveKeywordAliases,
  type CardLocalization,
  type KeywordSample,
} from "@/domain/cards/localized";
import type { LocalizationWriter } from "@/domain/ports/card-repository";

/** Lo que se lee del bulk con todos los idiomas, ya mapeado (ver `toLocalizedRecord`). */
export type LocalizedSourceRecord =
  | { kind: "localized"; localization: CardLocalization }
  | { kind: "english"; oracleId: string; keywords: string[]; text: string | null };

export interface LocalizedSource {
  /** De cuándo es la versión que hay ahora (sin descargarla). */
  updatedAt(): Promise<string>;
  /** Todas las impresiones (de la red, en streaming). */
  read(): AsyncIterable<LocalizedSourceRecord | null>;
}

/** Las traducciones cambian poco y el fichero pesa mucho: una vez por semana. */
export const LOCALIZATION_MAX_AGE_MS = 7 * 24 * 3_600_000;

export interface LocalizationSyncResult {
  /** synced = descargado y guardado; fresh = no tocaba todavía. */
  status: "synced" | "fresh";
  rows: number;
  aliases: number;
}

/**
 * Guarda el nombre, tipo y texto impresos de cada carta en cada idioma (la mejor impresión de
 * cada una, `betterLocalization`) y aprende cómo se dicen las habilidades clave en cada idioma.
 * Si falla, lanza y se conserva lo de antes (el reemplazo va en una transacción).
 */
export async function syncLocalizations(
  source: LocalizedSource,
  writer: LocalizationWriter,
  opts: { force?: boolean; now?: () => Date; onProgress?: (msg: string) => void } = {},
): Promise<LocalizationSyncResult> {
  const now = opts.now ?? (() => new Date());
  const last = await writer.localizationSync();
  if (!opts.force && last && now().getTime() - last.syncedAt.getTime() < LOCALIZATION_MAX_AGE_MS) {
    return { status: "fresh", rows: last.rows, aliases: 0 };
  }
  const updatedAt = await source.updatedAt();
  if (!opts.force && last?.bulkUpdatedAt === updatedAt) {
    return { status: "fresh", rows: last.rows, aliases: 0 };
  }

  const best = new Map<string, CardLocalization>();
  const english = new Map<string, { keywords: string[]; text: string | null }>();
  let seen = 0;
  for await (const r of source.read()) {
    seen += 1;
    if (seen % 20_000 === 0) opts.onProgress?.(`${seen} impresiones leídas`);
    if (!r) continue;
    if (r.kind === "english") {
      if (!english.has(r.oracleId)) english.set(r.oracleId, { keywords: r.keywords, text: r.text });
      continue;
    }
    const key = `${r.localization.oracleId}|${r.localization.lang}`;
    const prev = best.get(key);
    best.set(key, prev ? betterLocalization(prev, r.localization) : r.localization);
  }

  const rows = [...best.values()];
  const byOracle = new Map<string, CardLocalization[]>();
  for (const l of rows) byOracle.set(l.oracleId, [...(byOracle.get(l.oracleId) ?? []), l]);
  function* samples(): Generator<KeywordSample> {
    for (const [oracleId, en] of english) {
      const localized = byOracle.get(oracleId);
      if (localized && en.keywords.length) {
        yield { keywords: en.keywords, englishText: en.text, localized };
      }
    }
  }
  const aliases = deriveKeywordAliases(samples());
  await writer.replaceLocalizations(rows, aliases, { syncedAt: now(), bulkUpdatedAt: updatedAt });
  return { status: "synced", rows: rows.length, aliases: aliases.length };
}
