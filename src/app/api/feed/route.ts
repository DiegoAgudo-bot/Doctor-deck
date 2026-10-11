import { connection, type NextRequest } from "next/server";
import { activityFeed } from "@/application/feed";
import type { FeedType } from "@/domain/feed/feed";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { FEED_TYPES, feedCommanderIds, feedItemDTO, type FeedDTO } from "@/server/social-dto";

/**
 * Feed de actividad de la gente que sigo y de mis grupos. `?before=` (ISO, el `next` de la
 * página anterior) y `?types=deck,game` para filtrar.
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const q = req.nextUrl.searchParams;
    const before = q.get("before");
    const date = before ? new Date(before) : undefined;
    const types = (q.get("types") ?? "")
      .split(",")
      .filter((t): t is FeedType => (FEED_TYPES as readonly string[]).includes(t));
    const deps = socialDeps();
    const feed = await activityFeed(
      user.id,
      { before: date && !Number.isNaN(date.getTime()) ? date : undefined, types },
      deps,
    );
    const cards = new Map(
      (await deps.cards.findCardsByOracleIds(feedCommanderIds(feed.items))).map((c) => [
        c.oracleId,
        c,
      ]),
    );
    const body: FeedDTO = {
      items: feed.items.map((i) => feedItemDTO(i, cards)),
      next: feed.next?.toISOString() ?? null,
      following: feed.following,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
