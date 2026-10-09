import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { deckSummaries } from "@/server/deck-summaries";
import type { CommunityDeckDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** Los últimos mazos públicos de la comunidad, con su dueño. */
export async function GET() {
  await connection();
  try {
    const c = getContainer();
    const decks = await c.publicDecks.recent(24);
    const [summaries, owners] = await Promise.all([
      deckSummaries(decks, c.cards),
      Promise.all([...new Set(decks.map((d) => d.ownerId))].map((id) => c.social.byId(id))),
    ]);
    const byId = new Map(owners.flatMap((o) => (o ? [[o.id, o] as const] : [])));
    const body: CommunityDeckDTO[] = summaries.map((s, i) => {
      const owner = byId.get(decks[i]?.ownerId ?? "");
      return { ...s, owner: { username: owner?.username ?? null, name: owner?.name ?? "" } };
    });
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
