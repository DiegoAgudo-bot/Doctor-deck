import { connection } from "next/server";
import { isLocale, pick } from "@/domain/i18n/locale";
import { formatEuros } from "@/domain/suggestions/format";
import { getContainer } from "@/server/container";
import { OG_SIZE, ogImage } from "@/server/og";
import { artCrop, imageDataUri } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Carta de Magic en Doctor Deck";

/** Vista previa al compartir una carta: su arte, nombre, tipo y precio. */
export default async function Image({ params }: { params: Promise<{ id: string; lang: string }> }) {
  await connection();
  const c = getContainer();
  const { id, lang } = await params;
  const locale = isLocale(lang) ? lang : "es";
  const t = (es: string, en: string) => pick(locale, es, en);
  const subtitle = t(
    "Precio, ediciones y mazos de Commander",
    "Price, printings and Commander decks",
  );
  const [card] = await c.cards.findCardsByOracleIds([id.slice(0, 64)]);
  if (!card) {
    return ogImage({
      art: null,
      kicker: "Commander",
      title: t("Buscar cartas", "Search cards"),
      subtitle,
    });
  }
  const price = (await c.cards.findMinPrices([card.oracleId])).get(card.oracleId);
  return ogImage({
    art: await imageDataUri(artCrop(card.imageUrl)),
    kicker: card.typeLine,
    title: card.name,
    subtitle,
    colors: card.colorIdentity,
    tags: [
      ...(typeof price === "number" ? [`${t("Desde", "From")} ${formatEuros(price, locale)}`] : []),
      ...(card.gameChanger ? ["Game changer"] : []),
    ],
  });
}
