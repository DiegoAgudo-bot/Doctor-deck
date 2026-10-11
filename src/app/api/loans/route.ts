import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { lendCard, myLoans } from "@/application/loans";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { socialDeps } from "@/server/social";
import { loanDTO, type LoansDTO } from "@/server/social-dto";

/** Lo que he prestado y lo que me han prestado (`?all=1`: también los devueltos). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const deps = socialDeps();
    const loans = await myLoans(user.id, req.nextUrl.searchParams.get("all") === "1", deps);
    const ids = [...new Set([...loans.lent, ...loans.borrowed].map((l) => l.oracleId))];
    const cards = new Map((await deps.cards.findCardsByOracleIds(ids)).map((c) => [c.oracleId, c]));
    const body: LoansDTO = {
      lent: loans.lent.map((l) => loanDTO(l, cards)),
      borrowed: loans.borrowed.map((l) => loanDTO(l, cards)),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

const loanSchema = z.object({
  oracleId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(99).default(1),
  /** "@usuario" o el nombre de quien no tiene cuenta. */
  to: z.string().min(1).max(80),
  note: z.string().max(500).optional(),
});

/** Prestar copias libres de una carta. Devuelve el id del préstamo. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const id = await lendCard(user.id, loanSchema.parse(await req.json()), socialDeps());
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
