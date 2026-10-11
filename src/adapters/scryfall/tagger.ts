import { z } from "zod";
import type { TaggerSource } from "@/domain/ports/tagger-source";
import { HttpError, NetworkError, type HttpClient } from "../http/http-client";
import { TaggerError } from "./tagger-errors";

const API = "https://api.scryfall.com";
/** Tope de páginas por etiqueta (175 cartas cada una): de sobra para las que usamos. */
const MAX_PAGES = 80;
const TAG_RE = /^[a-z0-9-]+$/;

/** Solo lo que usamos de la búsqueda de Scryfall (lista paginada de cartas). */
const searchPage = z.object({
  object: z.literal("list"),
  has_more: z.boolean(),
  next_page: z.string().optional(),
  data: z.array(
    z.looseObject({
      oracle_id: z.string().optional(),
      // Cartas reversibles: el oracle_id va en cada cara.
      card_faces: z.array(z.looseObject({ oracle_id: z.string().optional() })).optional(),
    }),
  ),
});

/**
 * Cartas con una etiqueta de Tagger, con la búsqueda pública de Scryfall (`otag:<tag>`, una
 * carta por oracle_id). Rate limit y User-Agent del `HttpClient` de Scryfall. Si una etiqueta no
 * tiene ninguna carta (o no existe), Scryfall responde 404 y se devuelve una lista vacía.
 */
export class ScryfallTagger implements TaggerSource {
  constructor(private readonly http: HttpClient) {}

  async cardsWithTag(tag: string): Promise<string[]> {
    if (!TAG_RE.test(tag)) throw new TaggerError("format", `Etiqueta no válida: ${tag}`);
    const ids = new Set<string>();
    let url: string | undefined =
      `${API}/cards/search?q=${encodeURIComponent(`otag:${tag}`)}&unique=cards&order=name`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const json = await this.fetch(url, tag);
      if (json === null) break;
      const parsed = searchPage.safeParse(json);
      if (!parsed.success) {
        throw new TaggerError("format", `Respuesta inesperada de Scryfall para otag:${tag}`);
      }
      for (const card of parsed.data.data) {
        const id = card.oracle_id ?? card.card_faces?.[0]?.oracle_id;
        if (id) ids.add(id);
      }
      const next = parsed.data.has_more ? parsed.data.next_page : undefined;
      // Solo se siguen enlaces a la propia API de Scryfall.
      url = next?.startsWith(`${API}/`) ? next : undefined;
    }
    return [...ids];
  }

  /** JSON de la página, o null si Scryfall dice que no hay cartas (404). */
  private async fetch(url: string, tag: string): Promise<unknown> {
    try {
      return await this.http.getJson(url);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 404) return null;
        if (err.status === 403 || err.status === 429) {
          throw new TaggerError(
            "blocked",
            `Scryfall ha rechazado la búsqueda de otag:${tag} (HTTP ${err.status})`,
          );
        }
        throw new TaggerError("unavailable", `Scryfall no responde (HTTP ${err.status})`);
      }
      if (err instanceof NetworkError) throw new TaggerError("unavailable", err.message);
      if (err instanceof SyntaxError) {
        throw new TaggerError("format", `Respuesta no JSON de Scryfall para otag:${tag}`);
      }
      throw err;
    }
  }
}
