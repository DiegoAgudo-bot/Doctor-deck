import { connection } from "next/server";
import { OG_SIZE, ogImage } from "@/server/og";
import { deckShare, imageDataUri } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Mazo de Commander en Deck Doctor";

/** Vista previa al compartir un mazo: arte del comandante, nombre, colores y bracket. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const deck = await deckShare((await params).id);
  if (!deck) {
    return ogImage({
      art: null,
      kicker: "Commander",
      title: "Un mazo privado",
      subtitle: "Mejora tus mazos con las cartas que ya tienes",
    });
  }
  return ogImage({
    art: await imageDataUri(deck.artPath),
    kicker: deck.owner ? `Mazo de @${deck.owner}` : "Mazo de Commander",
    title: deck.name,
    subtitle: deck.commanders.join(" + "),
    colors: deck.colors,
    tags: [
      `${deck.cardCount} cartas`,
      ...(deck.bracket !== null ? [`Bracket ${deck.bracket}`] : []),
    ],
  });
}
