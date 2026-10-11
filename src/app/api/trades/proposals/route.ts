import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { createProposal, myProposals } from "@/application/trade-proposals";
import type { TradeProposalSummaryDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { proposalLinesSchema } from "@/server/trade-lines";
import { proposalSummaryDTO, tradeDeps } from "@/server/trades";

/** Mis propuestas de intercambio: enviadas, recibidas y mis borradores. */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const list = await myProposals(user.id, tradeDeps());
    const body: TradeProposalSummaryDTO[] = list.map((l) =>
      proposalSummaryDTO(l.proposal, l.partner, l.sides, l.balance, user.id),
    );
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const createSchema = z.object({
  username: z.string().min(1).max(40),
  lines: proposalLinesSchema,
  /** true = enviarla ya; false = guardarla como borrador. */
  send: z.boolean().default(false),
});

/** Crea una propuesta (borrador o enviada). Devuelve su id. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const input = createSchema.parse(await req.json());
    const id = await createProposal(user.id, input, tradeDeps());
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
