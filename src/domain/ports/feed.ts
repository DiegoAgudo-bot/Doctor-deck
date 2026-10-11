import type { FeedItem } from "../feed/feed";

/** Cada fuente devuelve lo de esos usuarios anterior a `before`, de lo más nuevo a lo más viejo. */
export interface FeedSource {
  activity(
    actorIds: readonly string[],
    viewerId: string,
    before: Date,
    limit: number,
  ): Promise<FeedItem[][]>;
}
