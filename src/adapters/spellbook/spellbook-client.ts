import { createHash } from "node:crypto";
import type { Combo, DeckCombos } from "@/domain/combos/types";
import type { ResponseCache } from "@/domain/ports/cache";
import type { ComboQuery, ComboSource } from "@/domain/ports/combo-source";
import { HttpError, type HttpClient } from "../http/http-client";
import { ComboSourceError } from "./errors";
import { parseFindMyCombos } from "./find-my-combos";

export const SPELLBOOK_API = "https://backend.commanderspellbook.com";
/** Con 500 por página cabe un mazo entero (un Commander típico da ~15 completos y ~300 a una). */
const PAGE = 500;

export interface SpellbookClientOptions {
  /** HttpClient con el User-Agent del proyecto y su propio rate limit. */
  http: HttpClient;
  cache: ResponseCache;
  ttlMs: number;
  now?: () => Date;
}

/**
 * Adaptador de Commander Spellbook (API pública, no documentada oficialmente). Mismas reglas que
 * EDHREC: caché con TTL (por la lista de cartas del mazo), copia caducada si falla, 403/429 sin
 * reintentos y errores tipados.
 */
export class SpellbookClient implements ComboSource {
  private readonly now: () => Date;

  constructor(private readonly opts: SpellbookClientOptions) {
    this.now = opts.now ?? (() => new Date());
  }

  async findCombos(deck: ComboQuery): Promise<DeckCombos> {
    const body = {
      commanders: [...deck.commanders].sort().map((card) => ({ card })),
      main: [...deck.main]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ card: c.name, quantity: c.quantity })),
    };
    const key = `spellbook:find-my-combos:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`;
    const cached = await this.opts.cache.get(key);
    const fresh = cached && this.now().getTime() - cached.fetchedAt.getTime() < this.opts.ttlMs;
    if (cached && fresh)
      return {
        ...readCached(cached.body),
        fetchedAt: cached.fetchedAt,
        stale: false,
        warning: null,
      };

    try {
      const res = await this.opts.http.postJson(
        `${SPELLBOOK_API}/find-my-combos?limit=${PAGE}`,
        body,
      );
      const parsed = parseFindMyCombos(await res.json());
      if (!parsed) {
        throw new ComboSourceError(
          "format",
          "Commander Spellbook ha devuelto algo que no entendemos (puede que haya cambiado su API).",
        );
      }
      const fetchedAt = this.now();
      const combos = { included: parsed.included, almostIncluded: parsed.almostIncluded };
      await this.opts.cache.set(key, { body: JSON.stringify(combos), fetchedAt });
      return {
        ...combos,
        fetchedAt,
        stale: false,
        warning: parsed.complete ? null : "Hay más combos de los que se muestran.",
      };
    } catch (err) {
      const error =
        err instanceof ComboSourceError
          ? err
          : err instanceof HttpError && (err.status === 403 || err.status === 429)
            ? new ComboSourceError(
                "blocked",
                "Commander Spellbook ha rechazado la petición. Prueba más tarde.",
              )
            : new ComboSourceError(
                "unavailable",
                "No se ha podido contactar con Commander Spellbook.",
              );
      if (cached) {
        return {
          ...readCached(cached.body),
          fetchedAt: cached.fetchedAt,
          stale: true,
          warning: `${error.message} Se muestran los combos guardados del ${cached.fetchedAt.toLocaleDateString("es")}.`,
        };
      }
      throw error;
    }
  }
}

function readCached(body: string): { included: Combo[]; almostIncluded: Combo[] } {
  return JSON.parse(body) as { included: Combo[]; almostIncluded: Combo[] };
}
