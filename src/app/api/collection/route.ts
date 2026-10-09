import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { importCollection } from "@/application/import-collection";
import { getContainer } from "@/server/container";
import { collectionImportResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Cuerpo: el texto del CSV exportado por ManaBox. Con sesión reemplaza la colección guardada; sin
 * ella solo la empareja y devuelve `owned` para que el navegador la guarde y la mande al analizar.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
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
    const browser = new BrowserCollectionRepository();
    const summary = await importCollection(text, {
      cards: c.cards,
      collection: user ? c.collectionFor(user.id) : browser,
    });
    const owned = user ? null : [...(await browser.ownedQuantities())];
    return Response.json(collectionImportResponse(summary, owned));
  } catch (err) {
    return errorResponse(err);
  }
}
