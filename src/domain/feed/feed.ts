/** Feed de actividad: lo que ha hecho la gente que sigo, mezclado por fecha. */

interface Base {
  /** Único dentro del feed (tipo + id del origen). */
  id: string;
  at: Date;
  actor: { id: string; username: string; name: string };
}

export type FeedItem =
  | (Base & {
      type: "deck";
      deck: { id: string; name: string; commanders: string[]; commanderIds: string[] };
    })
  | (Base & {
      type: "like";
      deck: { id: string; name: string; commanders: string[]; commanderIds: string[] };
      owner: { username: string };
    })
  | (Base & {
      type: "comment";
      deck: { id: string; name: string; commanders: string[]; commanderIds: string[] };
      excerpt: string;
    })
  | (Base & {
      type: "game";
      game: {
        id: string;
        group: { id: string; name: string } | null;
        players: number;
        won: boolean;
        deckName: string;
        winner: string | null;
      };
    })
  | (Base & {
      type: "trade";
      partner: { username: string };
      cards: number;
    });

export type FeedType = FeedItem["type"];

/**
 * Mezcla varias fuentes (cada una de la más nueva a la más vieja) y se queda con las `limit` más
 * nuevas. Junta en un elemento los "me gusta" seguidos de una persona al mismo mazo.
 */
export function mergeFeed(sources: readonly (readonly FeedItem[])[], limit: number): FeedItem[] {
  const seen = new Set<string>();
  return sources
    .flat()
    .filter((i) => !seen.has(i.id) && (seen.add(i.id), true))
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Recorta un comentario para enseñarlo en el feed. */
export function excerpt(text: string, max = 140) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
