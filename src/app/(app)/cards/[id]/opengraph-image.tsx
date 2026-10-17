import { connection } from "next/server";
import { formatEuros } from "@/domain/suggestions/format";
import { getContainer } from "@/server/container";
import { OG_SIZE, ogImage } from "@/server/og";
import { artCrop, imageDataUri } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Carta de Magic en Doctor Deck";

/** Vista previa al compartir una carta: su arte, nombre, tipo y precio. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const c = getContainer();
  const [card] = await c.cards.findCardsByOracleIds([(await params).id.slice(0, 64)]);
  if (!card) {
    return ogImage({
      art: null,
      kicker: "Commander",
      title: "Buscar cartas",
      subtitle: "Precio, ediciones y mazos de Commander",
    });
  }
  const price = (await c.cards.findMinPrices([card.oracleId])).get(card.oracleId);
  return ogImage({
    art: await imageDataUri(artCrop(card.imageUrl)),
    kicker: card.typeLine,
    title: card.name,
    subtitle: "Precio, ediciones y mazos de Commander",
    colors: card.colorIdentity,
    tags: [
      ...(typeof price === "number" ? [`Desde ${formatEuros(price)}`] : []),
      ...(card.gameChanger ? ["Game changer"] : []),
    ],
  });
}
