import type { ResponseCache } from "@/domain/ports/cache";
import type {
  AverageDeckSource,
  RecommendationQuery,
  RecommendationSource,
} from "@/domain/ports/recommendation-source";
import type { AverageDeck, CommanderRecommendations } from "@/domain/recommendations/types";
import { HttpError, NetworkError, type HttpClient } from "../http/http-client";
import { EdhrecError } from "./errors";
import { parseAverageDeck } from "./average-deck";
import { parseEdhrecPage } from "./page";
import { commanderSlug, isValidThemeSlug } from "./slug";

export const EDHREC_JSON_BASE = "https://json.edhrec.com/pages";

export interface EdhrecClientOptions {
  /** HttpClient con el User-Agent del proyecto y EDHREC_MIN_INTERVAL_MS. */
  http: HttpClient;
  cache: ResponseCache;
  ttlMs: number;
  now?: () => Date;
  baseUrl?: string;
}

interface Fetched<T> {
  page: T;
  fetchedAt: Date;
  stale: boolean;
  warning: string | null;
}

/** Intérprete de un tipo de página: la página o una redirección a otra ruta. */
type Parser<T> = (
  body: string,
  url: string,
) => { kind: "page"; page: T } | { kind: "redirect"; path: string };

/**
 * Adaptador de los JSON públicos (no oficiales) de EDHREC. Todo acceso a EDHREC pasa por aquí.
 * - Caché por URL con TTL; solo se cachean respuestas que se han podido interpretar.
 * - Si EDHREC falla y hay copia caducada, se devuelve marcada como `stale` con un aviso.
 * - 403/429 no se reintentan: se informa al usuario (no se intenta esquivar el bloqueo).
 */
export class EdhrecClient implements RecommendationSource, AverageDeckSource {
  private readonly now: () => Date;
  private readonly baseUrl: string;

  constructor(private readonly opts: EdhrecClientOptions) {
    this.now = opts.now ?? (() => new Date());
    this.baseUrl = opts.baseUrl ?? EDHREC_JSON_BASE;
  }

  /** URL del JSON que se pediría para esa consulta (útil para depurar o guardar fixtures). */
  pageUrl(query: RecommendationQuery): string {
    return `${this.baseUrl}${this.pathFor(query).path}.json`;
  }

  async getRecommendations(query: RecommendationQuery): Promise<CommanderRecommendations> {
    const { slug, path } = this.pathFor(query);
    const { theme } = query;
    const { page, fetchedAt, stale, warning } = await this.fetchPage(path, parseEdhrecPage, 1);
    return {
      commanderSlug: slug,
      theme: theme ?? null,
      totalDecks: page.totalDecks,
      themes: page.themes,
      cards: page.cards,
      fetchedAt,
      stale,
      warning,
    };
  }

  /** Mazo medio del comandante (y tema): /average-decks/{slug}[/{tema}]. Mismas reglas de caché. */
  async getAverageDeck(query: RecommendationQuery): Promise<AverageDeck> {
    const { slug } = this.pathFor(query);
    const path = `/average-decks/${slug}${query.theme ? `/${query.theme}` : ""}`;
    const { page, fetchedAt, stale, warning } = await this.fetchPage(path, parseAverageDeck, 1);
    return {
      commanderSlug: slug,
      theme: query.theme ?? null,
      commanders: page.commanders,
      cards: page.cards,
      fetchedAt,
      stale,
      warning,
    };
  }

  private pathFor({ commanders, theme }: RecommendationQuery) {
    if (commanders.length < 1 || commanders.length > 2) {
      throw new EdhrecError("invalid_query", "Indica 1 o 2 comandantes");
    }
    if (theme !== undefined && !isValidThemeSlug(theme)) {
      throw new EdhrecError("invalid_query", `Tema no válido: "${theme}"`);
    }
    const slug = commanderSlug(commanders);
    return { slug, path: `/commanders/${slug}${theme ? `/${theme}` : ""}` };
  }

  private async fetchPage<T>(
    path: string,
    parse: Parser<T>,
    redirectsLeft: number,
  ): Promise<Fetched<T>> {
    const url = `${this.baseUrl}${path}.json`;
    const cached = await this.opts.cache.get(url);
    const now = this.now();

    if (cached && now.getTime() - cached.fetchedAt.getTime() < this.opts.ttlMs) {
      return this.fromBody(cached.body, cached.fetchedAt, url, parse, redirectsLeft, false, null);
    }

    let body: string;
    try {
      body = await (await this.opts.http.get(url)).text();
    } catch (err) {
      const error = toEdhrecError(err, url);
      if (cached && error.code !== "not_found") {
        return this.fromBody(
          cached.body,
          cached.fetchedAt,
          url,
          parse,
          redirectsLeft,
          true,
          staleWarning(error, cached.fetchedAt),
        );
      }
      throw error;
    }

    const result = parse(body, url); // lanza "format" antes de cachear nada
    await this.opts.cache.set(url, { body, fetchedAt: now });
    if (result.kind === "redirect") return this.follow(result.path, parse, redirectsLeft, url);
    return { page: result.page, fetchedAt: now, stale: false, warning: null };
  }

  private async fromBody<T>(
    body: string,
    fetchedAt: Date,
    url: string,
    parse: Parser<T>,
    redirectsLeft: number,
    stale: boolean,
    warning: string | null,
  ): Promise<Fetched<T>> {
    const result = parse(body, url);
    if (result.kind === "redirect") return this.follow(result.path, parse, redirectsLeft, url);
    return { page: result.page, fetchedAt, stale, warning };
  }

  private follow<T>(
    path: string,
    parse: Parser<T>,
    redirectsLeft: number,
    url: string,
  ): Promise<Fetched<T>> {
    if (redirectsLeft <= 0)
      throw new EdhrecError("format", "EDHREC ha devuelto demasiadas redirecciones", url);
    return this.fetchPage(path, parse, redirectsLeft - 1);
  }
}

function toEdhrecError(err: unknown, url: string): EdhrecError {
  if (err instanceof EdhrecError) return err;
  if (err instanceof HttpError) {
    if (err.status === 404) {
      return new EdhrecError("not_found", "EDHREC no tiene página para ese comandante o tema", url);
    }
    if (err.status === 403 || err.status === 429) {
      return new EdhrecError(
        "blocked",
        `EDHREC ha rechazado la petición (HTTP ${err.status}). No se reintenta automáticamente; espera un rato o revisa el User-Agent.`,
        url,
      );
    }
    return new EdhrecError(
      "unavailable",
      `EDHREC ha respondido con un error (HTTP ${err.status})`,
      url,
    );
  }
  if (err instanceof NetworkError) return new EdhrecError("unavailable", err.message, url);
  return new EdhrecError("unavailable", err instanceof Error ? err.message : String(err), url);
}

function staleWarning(error: EdhrecError, fetchedAt: Date): string {
  return `No se pudo actualizar desde EDHREC (${error.message}). Se usan datos guardados del ${fetchedAt.toISOString().slice(0, 10)}.`;
}
