import { connection, type NextRequest } from "next/server";
import { profileView } from "@/application/social";
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
    const body: ProfileViewDTO = {
      profile: publicProfileDTO(view.profile),
      followers: view.followers,
      following: view.following,
      isMe: view.isMe,
      isFollowing: view.isFollowing,
      decks: await deckSummaries(view.decks, c.cards),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
