import { connection, type NextRequest } from "next/server";
import { tradeMatches } from "@/application/trades";
import { publicProfileDTO, type TradePartnerDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { tradeCards, tradeDeps } from "@/server/trades";

/** Cruces con la gente que tiene listas públicas (o solo con `?username=`). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const username = req.nextUrl.searchParams.get("username") ?? undefined;
    const { partners, prices } = await tradeMatches(user.id, tradeDeps(), { username });
    const body: TradePartnerDTO[] = await Promise.all(
      partners.map(async (p) => ({
        profile: publicProfileDTO(p.profile),
        following: p.following,
        theyHave: (await tradeCards(p.theyHave, prices)).dto,
        theyWant: (await tradeCards(p.theyWant, prices)).dto,
        haveValue: p.haveValue,
        wantValue: p.wantValue,
      })),
    );
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
