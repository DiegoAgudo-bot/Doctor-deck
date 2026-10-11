import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { tradeCalculator } from "@/application/trade-proposals";
import { publicProfileDTO, type TradeCalculatorDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { tradeCopiesDTO, tradeDeps } from "@/server/trades";

/** Calculadora con `?username=`: propuesta inicial cuadrada y lo que cada uno tiene para cambiar. */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const username = z
      .string()
      .min(1)
      .max(40)
      .parse(req.nextUrl.searchParams.get("username") ?? "");
    const calc = await tradeCalculator(user.id, username, tradeDeps());
    const [give, get, myCopies, theirCopies] = await tradeCopiesDTO(
      calc.sides.give,
      calc.sides.get,
      calc.myCopies,
      calc.theirCopies,
    );
    const body: TradeCalculatorDTO = {
      partner: publicProfileDTO(calc.partner),
      give: give ?? [],
      get: get ?? [],
      balance: calc.balance,
      myCopies: myCopies ?? [],
      theirCopies: theirCopies ?? [],
      openProposalId: calc.openProposalId,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
