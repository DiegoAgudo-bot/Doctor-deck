import { connection } from "next/server";
import type { StatusResponse } from "@/server/dto";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

/** Estado del catálogo y, si hay sesión, del usuario y su colección. */
export async function GET(request: Request) {
  await connection(); // better-sqlite3 es síncrono: forzamos que se ejecute en cada petición
  try {
    const c = getContainer();
    const user = await currentUser(request);
    const [catalog, collection] = await Promise.all([
      c.cards.counts(),
      user ? c.collectionFor(user.id).summary() : null,
    ]);
    const body: StatusResponse = {
      catalog,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      collection: collection
        ? { ...collection, importedAt: collection.importedAt?.toISOString() ?? null }
        : null,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
