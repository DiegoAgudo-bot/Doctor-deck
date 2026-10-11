import { connection, type NextRequest } from "next/server";
import { exportMyData } from "@/application/account";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Todos mis datos en un JSON que se descarga (RGPD: acceso y portabilidad). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const c = getContainer();
    const data = await exportMyData(user.id, {
      profiles: c.social,
      follows: c.social,
      collection: c.collectionFor(user.id),
      decks: c.decksFor(user.id),
      trades: c.tradesFor(user.id),
      roleOverrides: c.roleOverridesFor(user.id),
      proposals: c.tradeProposals,
      groups: c.groups,
      games: c.games,
      loans: c.loans,
      comments: c.moderation,
      blocks: c.moderation,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="doctor-deck-mis-datos-${date}.json"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
