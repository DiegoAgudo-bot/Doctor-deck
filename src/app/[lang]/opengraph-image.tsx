import { isLocale, pick } from "@/domain/i18n/locale";
import { OG_SIZE, ogImage } from "@/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Doctor Deck: mejora tus mazos de Commander con las cartas que ya tienes";

/** Vista previa por defecto (portada y páginas sin una propia). */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = (es: string, en: string) => pick(isLocale(lang) ? lang : "es", es, en);
  return ogImage({
    art: null,
    kicker: "Magic: The Gathering · Commander",
    title: t(
      "Mejora tus mazos con las cartas que ya tienes",
      "Upgrade your decks with the cards you already own",
    ),
    subtitle: t(
      "Cambios 1×1, tu colección, precios, combos e intercambios",
      "1-for-1 swaps, your collection, prices, combos and trades",
    ),
    colors: ["W", "U", "B", "R", "G"],
    tags: [t("Gratis", "Free"), t("Sin anuncios", "No ads")],
  });
}
