import { connection, type NextRequest } from "next/server";
import { commanderInfo } from "@/application/new-deck";
import { getContainer } from "@/server/container";
import { cardDTO, type CommanderInfoDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** GET /api/commanders?ids=oracleId[,oracleId]: temas de EDHREC y nombre propuesto para el mazo. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const ids = (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
    const c = getContainer();
    const info = await commanderInfo(ids, { cards: c.cards, recommendations: c.edhrec });
    const body: CommanderInfoDTO = {
      commanders: info.commanders.map(cardDTO),
      themes: info.themes,
      totalDecks: info.totalDecks,
      suggestedName: info.suggestedName,
      warning: info.warning,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
