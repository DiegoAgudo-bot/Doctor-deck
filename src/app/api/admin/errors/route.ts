import { connection } from "next/server";
import { forbidden } from "@/application/errors";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import type { ErrorLogEntryDTO } from "@/server/dto";
import { requireUser } from "@/server/session";
import { isAdmin } from "@/server/social";

async function admin(req: Request) {
  const user = await requireUser(req);
  if (!isAdmin(user)) throw forbidden("Solo para administradores.");
}

/** Los errores registrados, los más recientes primero (solo administradores). */
export async function GET(req: Request) {
  await connection();
  try {
    await admin(req);
    const list = await getContainer().errorLog.list(200);
    const body: ErrorLogEntryDTO[] = list.map((e) => ({
      id: e.id,
      source: e.source,
      message: e.message,
      stack: e.stack ?? null,
      path: e.path ?? null,
      userAgent: e.userAgent ?? null,
      count: e.count,
      firstAt: e.firstAt.toISOString(),
      lastAt: e.lastAt.toISOString(),
    }));
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Vacía el registro. */
export async function DELETE(req: Request) {
  try {
    await admin(req);
    await getContainer().errorLog.clear();
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
