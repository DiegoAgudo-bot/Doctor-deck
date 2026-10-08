import { importCollection } from "@/application/import-collection";
import { getContainer } from "@/server/container";
import { collectionImportResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";

const MAX_BYTES = 20 * 1024 * 1024;

/** Cuerpo: el texto del CSV exportado por ManaBox. Reemplaza la colección guardada. */
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.trim().length === 0) {
      return Response.json(
        { error: { code: "invalid_csv", message: "El fichero está vacío" } },
        { status: 400 },
      );
    }
    if (text.length > MAX_BYTES) {
      return Response.json(
        { error: { code: "too_large", message: "El CSV es demasiado grande" } },
        { status: 413 },
      );
    }
    const c = getContainer();
    const summary = await importCollection(text, { cards: c.cards, collection: c.collection });
    return Response.json(collectionImportResponse(summary));
  } catch (err) {
    return errorResponse(err);
  }
}
