import { connection } from "next/server";
import { OG_SIZE, ogImage } from "@/server/og";
import { imageDataUri, profileShare } from "@/server/share";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Perfil en Doctor Deck";

/** Vista previa al compartir un perfil: arte de su último mazo, nombre y mazos públicos. */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  await connection();
  const p = await profileShare((await params).username);
  if (!p) {
    return ogImage({
      art: null,
      kicker: "Perfil",
      title: "Doctor Deck",
      subtitle: "Mejora tus mazos con las cartas que ya tienes",
    });
  }
  return ogImage({
    art: await imageDataUri(p.artPath),
    kicker: `@${p.username}`,
    title: p.name,
    subtitle: p.commanders.length > 0 ? `Juega ${p.commanders.join(", ")}` : "Jugador de Commander",
    tags: [`${p.publicDecks} ${p.publicDecks === 1 ? "mazo público" : "mazos públicos"}`],
  });
}
