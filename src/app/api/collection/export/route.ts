import { connection, type NextRequest } from "next/server";
import { exportCollectionCsv } from "@/application/collection-cards";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mi colección como CSV con el formato de ManaBox (se descarga como fichero). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const c = getContainer();
    const { csv } = await exportCollectionCsv({
      cards: c.cards,
      collection: c.collectionFor(user.id),
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="doctor-deck-coleccion-${date}.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
