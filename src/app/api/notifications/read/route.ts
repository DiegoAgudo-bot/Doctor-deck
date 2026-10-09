import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Marca todas mis notificaciones como leídas. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await getContainer().social.markAllRead(user.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
