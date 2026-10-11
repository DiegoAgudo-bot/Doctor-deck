import type { CardTagWriter, TaggerSource } from "@/domain/ports/tagger-source";

export interface TagSyncResult {
  tag: string;
  /** synced = descargada; fresh = no tocaba todavía; failed = error (se conserva lo anterior). */
  status: "synced" | "fresh" | "failed";
  cards: number;
  error?: string;
}

/** Tagger cambia poco: por defecto, una vez por semana. */
export const OTAG_MAX_AGE_MS = 7 * 24 * 3_600_000;

/**
 * Sincroniza las etiquetas de Tagger (segunda fuente de roles). Cada etiqueta se reemplaza
 * entera solo si se descarga bien; si Scryfall falla, se conserva lo que había y se informa.
 */
export async function syncOracleTags(
  tags: readonly string[],
  deps: { source: TaggerSource; writer: CardTagWriter; now?: () => Date },
  opts: { force?: boolean; maxAgeMs?: number } = {},
): Promise<TagSyncResult[]> {
  const now = deps.now ?? (() => new Date());
  const maxAge = opts.maxAgeMs ?? OTAG_MAX_AGE_MS;
  const syncs = await deps.writer.tagSyncs();
  const results: TagSyncResult[] = [];
  for (const tag of tags) {
    const last = syncs.get(tag);
    if (!opts.force && last && now().getTime() - last.syncedAt.getTime() < maxAge) {
      results.push({ tag, status: "fresh", cards: last.cards });
      continue;
    }
    try {
      const ids = await deps.source.cardsWithTag(tag);
      await deps.writer.replaceTag(tag, ids, now());
      results.push({ tag, status: "synced", cards: ids.length });
    } catch (err) {
      results.push({
        tag,
        status: "failed",
        cards: last?.cards ?? 0,
        error: err instanceof Error ? err.message : String(err),
      });
      // Bloqueados (403/429) o Scryfall caído: no se insiste con las demás etiquetas.
      const code = err instanceof Error && "code" in err ? err.code : null;
      if (code === "blocked" || code === "unavailable") break;
    }
  }
  return results;
}
