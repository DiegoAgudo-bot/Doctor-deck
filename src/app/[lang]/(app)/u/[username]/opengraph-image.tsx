import { connection } from "next/server";
import { isLocale, pick } from "@/domain/i18n/locale";
import { OG_SIZE, ogImage } from "@/server/og";
import { imageDataUri, profileShare } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Perfil en Doctor Deck";

/** Vista previa al compartir un perfil: arte de su último mazo, nombre y mazos públicos. */
export default async function Image({
  params,
}: {
  params: Promise<{ username: string; lang: string }>;
}) {
  await connection();
  const { username, lang } = await params;
  const t = (es: string, en: string) => pick(isLocale(lang) ? lang : "es", es, en);
  const p = await profileShare(username);
  if (!p) {
    return ogImage({
      art: null,
      kicker: t("Perfil", "Profile"),
      title: "Doctor Deck",
      subtitle: t(
        "Mejora tus mazos con las cartas que ya tienes",
        "Upgrade your decks with the cards you already own",
      ),
    });
  }
  return ogImage({
    art: await imageDataUri(p.artPath),
    kicker: `@${p.username}`,
    title: p.name,
    subtitle:
      p.commanders.length > 0
        ? t(`Juega ${p.commanders.join(", ")}`, `Plays ${p.commanders.join(", ")}`)
        : t("Jugador de Commander", "Commander player"),
    tags: [
      p.publicDecks === 1
        ? t("1 mazo público", "1 public deck")
        : t(`${p.publicDecks} mazos públicos`, `${p.publicDecks} public decks`),
    ],
  });
}
