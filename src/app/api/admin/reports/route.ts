import { connection } from "next/server";
import { forbidden } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";
import { isAdmin } from "@/server/social";
import { reportedCommentDTO } from "@/server/social-dto";

/** Comentarios denunciados pendientes de revisar (solo administradores, `ADMIN_EMAILS`). */
export async function GET(req: Request) {
  await connection();
  try {
    const user = await requireUser(req);
    if (!isAdmin(user)) throw forbidden("Solo para administradores.");
    const list = await getContainer().moderation.pending(100);
    return Response.json(list.map(reportedCommentDTO));
  } catch (err) {
    return errorResponse(err);
  }
}
