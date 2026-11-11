import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { compareDeck } from "@/application/deck-compare";
import { notFound } from "@/application/errors";
import { localizeWarning } from "@/domain/i18n/warnings";
import { getContainer } from "@/server/container";
import { cardDTO, type DeckComparisonDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requestLocale } from "@/server/i18n";
import { clientKey, enforceLimit, routeLimits } from "@/server/rate-limit";
import { requireUser } from "@/server/session";

/**
 * Compara uno de mis mazos con el mazo medio de la comunidad (`?with=average`) o con una versión
 * anterior (`?with=<id de la versión>`): lo que solo lleva el mío y lo que solo lleva lo otro.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/decks/[id]/compare">) {
  await connection();
  try {
    const user = await requireUser(req);
    const id = (await ctx.params).id;
    if (!z.uuid().safeParse(id).success) throw notFound("Ese mazo no existe.");
    const against = req.nextUrl.searchParams.get("with") ?? "average";
    const c = getContainer();
    if (against === "average") enforceLimit(routeLimits.staples, clientKey(req, user.id));
    const result = await compareDeck(
      id,
      against === "average" ? { kind: "average" } : { kind: "version", versionId: against },
      { decks: c.decksFor(user.id), cards: c.cards, averageDecks: c.edhrec },
    );
    const rows = (list: typeof result.onlyMine) =>
      list.map((r) => ({ card: cardDTO(r.card), copies: r.copies }));
    const body: DeckComparisonDTO = {
      onlyMine: rows(result.onlyMine),
      onlyOther: rows(result.onlyOther),
      shared: result.shared,
      versionAt: result.versionAt?.toISOString() ?? null,
      warning: localizeWarning(result.warning, requestLocale(req)),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
