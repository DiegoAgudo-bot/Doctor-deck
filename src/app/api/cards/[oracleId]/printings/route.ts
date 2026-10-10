import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/server/container";
import { printingDTO, type PrintingDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";

/** Las impresiones de una carta (para elegir edición en un mazo), de la más nueva a la más vieja. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/cards/[oracleId]/printings">) {
  await connection();
  try {
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse((await ctx.params).oracleId);
    const body: PrintingDTO[] = (await getContainer().cards.findPrintingsOf(oracleId)).map(
      printingDTO,
    );
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
