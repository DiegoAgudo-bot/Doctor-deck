import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { daysBefore, priceChange } from "@/domain/prices/history";
import { getContainer } from "@/server/container";
import type { CardPricesDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** Histórico de precio de una carta (el de su impresión más barata cada día). Público. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/cards/[oracleId]/prices">) {
  await connection();
  try {
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse((await ctx.params).oracleId);
    const days = z.coerce
      .number()
      .int()
      .min(7)
      .max(730)
      .catch(90)
      .parse(req.nextUrl.searchParams.get("days") ?? 90);
    const { prices } = getContainer();
    const latest = await prices.latestDate();
    const history = latest ? await prices.history(oracleId, daysBefore(latest, days)) : [];
    const body: CardPricesDTO = { history, change: priceChange(history) };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
