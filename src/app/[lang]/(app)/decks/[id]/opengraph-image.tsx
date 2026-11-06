import { connection } from "next/server";
import { isLocale, pick } from "@/domain/i18n/locale";
import { OG_SIZE, ogImage } from "@/server/og";
import { deckShare, imageDataUri } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Mazo de Commander en Doctor Deck";

/** Vista previa al compartir un mazo: arte del comandante, nombre, colores y bracket. */
export default async function Image({ params }: { params: Promise<{ id: string; lang: string }> }) {
  await connection();
  const { id, lang } = await params;
  const t = (es: string, en: string) => pick(isLocale(lang) ? lang : "es", es, en);
  const deck = await deckShare(id);
  if (!deck) {
    return ogImage({
      art: null,
      kicker: "Commander",
      title: t("Un mazo privado", "A private deck"),
      subtitle: t(
        "Mejora tus mazos con las cartas que ya tienes",
        "Upgrade your decks with the cards you already own",
      ),
    });
  }
  return ogImage({
    art: await imageDataUri(deck.artPath),
    kicker: deck.owner
      ? t(`Mazo de @${deck.owner}`, `Deck by @${deck.owner}`)
      : t("Mazo de Commander", "Commander deck"),
    title: deck.name,
    subtitle: deck.commanders.join(" + "),
    colors: deck.colors,
    tags: [
      t(`${deck.cardCount} cartas`, `${deck.cardCount} cards`),
      ...(deck.bracket !== null ? [`Bracket ${deck.bracket}`] : []),
    ],
  });
}
