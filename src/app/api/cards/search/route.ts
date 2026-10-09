import { connection, type NextRequest } from "next/server";
import { getContainer } from "@/server/container";
import { cardDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** Buscador de cartas por nombre (autocompletar): GET /api/cards/search?q=sol+ri&limit=10 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    const limit = Math.min(
      25,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 10),
    );
    if (q.length < 2) return Response.json([]);
    const cards = await getContainer().cards.searchByName(q, limit);
    return Response.json(cards.map(cardDTO));
  } catch (err) {
    return errorResponse(err);
  }
}
