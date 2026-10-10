import { connection, type NextRequest } from "next/server";
import { getContainer } from "@/server/container";

/**
 * Imágenes de cartas desde nuestro servidor: de disco si ya se vieron, si no de cards.scryfall.io
 * (y se guardan). Ver `domain/cards/images.ts`.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/img/[...path]">) {
  await connection();
  const image = await getContainer().images.get((await ctx.params).path.join("/"));
  if (!image) return new Response("Imagen no disponible", { status: 404 });
  return new Response(new Blob([image.body as BlobPart]), {
    headers: {
      "Content-Type": image.contentType,
      // La ruta incluye el id de la impresión: no cambia, el navegador puede guardarla mucho.
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
