import { connection, type NextRequest } from "next/server";
import { commanderStaples } from "@/application/card-catalog";
import type { CommanderStaplesDTO } from "@/server/card-dto";
import { getContainer } from "@/server/container";
import { cardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";
import { clientKey, enforceLimit, routeLimits } from "@/server/rate-limit";

/**
 * Lo que se juega con un comandante según EDHREC, por listas (alta sinergia, criaturas,
 * instantáneos…), con precio y, con sesión, mis copias. `?theme=` para un tema. Pública.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/cards/[oracleId]/edhrec">) {
  await connection();
  try {
    const viewer = await currentUser(req);
    enforceLimit(routeLimits.staples, clientKey(req, viewer?.id));
    const c = getContainer();
    const theme = req.nextUrl.searchParams.get("theme");
    const s = await commanderStaples(
      (await ctx.params).oracleId.slice(0, 64),
      theme && /^[a-z0-9-]{1,60}$/.test(theme) ? theme : null,
      viewer?.id ?? null,
      {
        cards: c.cards,
        recommendations: c.edhrec,
        collectionFor: c.collectionFor,
        decksFor: c.decksFor,
      },
    );
    const body: CommanderStaplesDTO = {
      theme: s.theme,
      themes: s.themes,
      totalDecks: s.totalDecks,
      slug: s.slug,
      warning: s.warning,
      sections: s.sections.map((sec) => ({
        key: sec.key,
        label: sec.label,
        cards: sec.cards.map((r) => ({
          card: cardDTO(r.card),
          inclusion: r.inclusion,
          synergy: r.synergy,
          numDecks: r.numDecks,
          price: s.prices.get(r.card.oracleId) ?? null,
          mine: s.mine?.get(r.card.oracleId) ?? null,
        })),
      })),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
