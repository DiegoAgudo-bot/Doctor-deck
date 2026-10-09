import { connection, type NextRequest } from "next/server";
import { canBeCommander, fitsColorIdentity } from "@/domain/cards/commander";
import { COLORS, type Color } from "@/domain/cards/types";
import { getContainer } from "@/server/container";
import { cardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/**
 * Buscador de cartas por nombre (autocompletar): GET /api/cards/search?q=sol+ri&limit=10
 * - `commander=1`: solo cartas que pueden ser comandante.
 * - `identity=WR`: solo cartas que caben en esa identidad de color ("C" o vacío = incoloras).
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim().slice(0, 100);
    const limit = Math.min(25, Math.max(1, Number(params.get("limit")) || 10));
    if (q.length < 2) return Response.json([]);
    const onlyCommanders = params.get("commander") === "1";
    const identityParam = params.get("identity");
    const identity: Color[] | null =
      identityParam === null ? null : COLORS.filter((c) => identityParam.toUpperCase().includes(c));
    const filtering = onlyCommanders || identity !== null;
    // Con filtros se piden más y se filtran aquí (las reglas de comandante son del dominio).
    const found = await getContainer().cards.searchByName(q, filtering ? limit * 6 : limit);
    const cards = found
      .filter((c) => !onlyCommanders || canBeCommander(c))
      .filter((c) => identity === null || fitsColorIdentity(c, identity))
      .slice(0, limit);
    return Response.json(cards.map(cardDTO));
  } catch (err) {
    return errorResponse(err);
  }
}
