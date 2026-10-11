import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { actOnProposal, proposalView } from "@/application/trade-proposals";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { proposalLinesSchema } from "@/server/trade-lines";
import { proposalDTO, tradeDeps } from "@/server/trades";

type Ctx = RouteContext<"/api/trades/proposals/[id]">;

/** Una propuesta (solo para las dos partes; un borrador, solo para quien lo hizo). */
export async function GET(req: NextRequest, ctx: Ctx) {
  await connection();
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    return Response.json(await proposalDTO(await proposalView(user.id, id, tradeDeps()), user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), lines: proposalLinesSchema }),
  z.object({ action: z.literal("send"), lines: proposalLinesSchema.optional() }),
  z.object({ action: z.literal("counter"), lines: proposalLinesSchema }),
  z.object({ action: z.enum(["accept", "reject", "cancel", "delete"]) }),
]);

/**
 * Guardar o enviar un borrador, contraproponer, aceptar (mueve las cartas entre las dos
 * colecciones), rechazar, retirar o borrar un borrador. Devuelve la propuesta como queda.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    const act = actionSchema.parse(await req.json());
    const deps = tradeDeps();
    await actOnProposal(user.id, id, act, deps);
    if (act.action === "delete") return Response.json({ deleted: true });
    return Response.json(await proposalDTO(await proposalView(user.id, id, deps), user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
