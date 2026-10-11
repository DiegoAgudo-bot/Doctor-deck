import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { memberDTO } from "@/server/social-dto";

/** La gente que he bloqueado. */
export async function GET(req: Request) {
  await connection();
  try {
    const user = await requireUser(req);
    const list = await getContainer().moderation.blocked(user.id);
    return Response.json(
      list.map((b) => ({ ...memberDTO(b), blockedAt: b.blockedAt.toISOString() })),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
