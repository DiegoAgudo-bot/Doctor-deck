import { connection, type NextRequest } from "next/server";
import { gameStats } from "@/application/games";
import { profileView } from "@/application/social";
import { recordOf } from "@/domain/play/stats";
import { getContainer } from "@/server/container";
import { deckSummaries } from "@/server/deck-summaries";
import { publicProfileDTO, type ProfileViewDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

/** Perfil público: datos, seguidores, si le sigo y sus mazos públicos (todos, si soy yo). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/users/[username]">) {
  await connection();
  try {
    const viewer = await currentUser(req);
    const c = getContainer();
    const view = await profileView((await ctx.params).username, viewer?.id ?? null, {
      profiles: c.social,
      follows: c.social,
      decksFor: c.decksFor,
    });
    const [stats, blocked] = await Promise.all([
      gameStats({ userId: view.profile.id }, { games: c.games }),
      viewer && !view.isMe
        ? c.moderation.blocked(viewer.id).then((l) => l.some((b) => b.id === view.profile.id))
        : false,
    ]);
    const record = recordOf(stats.players, view.profile.id);
    const body: ProfileViewDTO = {
      profile: publicProfileDTO(view.profile),
      followers: view.followers,
      following: view.following,
      isMe: view.isMe,
      isFollowing: view.isFollowing,
      blocked,
      record: { games: record?.games ?? 0, wins: record?.wins ?? 0 },
      decks: await deckSummaries(view.decks, c.cards),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
