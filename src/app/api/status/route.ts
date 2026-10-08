import { connection } from "next/server";
import type { StatusResponse } from "@/server/dto";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";

export async function GET() {
  await connection(); // better-sqlite3 es síncrono: forzamos que se ejecute en cada petición
  try {
    const c = getContainer();
    const [catalog, collection] = await Promise.all([c.cards.counts(), c.collection.summary()]);
    const body: StatusResponse = {
      catalog,
      collection: { ...collection, importedAt: collection.importedAt?.toISOString() ?? null },
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
