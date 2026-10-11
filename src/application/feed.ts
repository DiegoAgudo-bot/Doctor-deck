import { mergeFeed, type FeedItem, type FeedType } from "@/domain/feed/feed";
import type { FeedSource } from "@/domain/ports/feed";
import type { BlockRepository } from "@/domain/ports/moderation";
import type { GroupRepository } from "@/domain/ports/play";
import type { FollowRepository } from "@/domain/ports/social";

export const FEED_PAGE = 30;

/**
 * Feed: lo que ha hecho la gente que sigo (y mis compañeros de grupo), sin bloqueados.
 * Paginado por fecha: `before` = la fecha del último elemento de la página anterior.
 */
export async function activityFeed(
  viewerId: string,
  opts: { before?: Date | undefined; types?: readonly FeedType[] | undefined; limit?: number },
  deps: {
    feed: FeedSource;
    follows: FollowRepository;
    groups: Pick<GroupRepository, "groupmateIds">;
    blocks: Pick<BlockRepository, "hiddenFor">;
  },
): Promise<{ items: FeedItem[]; next: Date | null; following: number }> {
  const limit = opts.limit ?? FEED_PAGE;
  const [following, mates, hidden] = await Promise.all([
    deps.follows.followingIds(viewerId),
    deps.groups.groupmateIds(viewerId),
    deps.blocks.hiddenFor(viewerId),
  ]);
  const actors = [...new Set([...following, ...mates])].filter((id) => !hidden.has(id));
  const sources = await deps.feed.activity(actors, viewerId, opts.before ?? new Date(), limit);
  const types = opts.types && opts.types.length ? new Set(opts.types) : null;
  const items = mergeFeed(
    sources.map((s) => (types ? s.filter((i) => types.has(i.type)) : s)),
    limit,
  );
  return {
    items,
    next: items.length === limit ? (items[items.length - 1]?.at ?? null) : null,
    following: actors.length,
  };
}
