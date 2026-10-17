import { OG_SIZE, ogImage } from "@/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Doctor Deck: mejora tus mazos de Commander con las cartas que ya tienes";

/** Vista previa por defecto (portada y páginas sin una propia). */
export default function Image() {
  return ogImage({
    art: null,
    kicker: "Magic: The Gathering · Commander",
    title: "Mejora tus mazos con las cartas que ya tienes",
    subtitle: "Cambios 1×1, tu colección, precios, combos e intercambios",
    colors: ["W", "U", "B", "R", "G"],
    tags: ["Gratis", "Sin anuncios"],
  });
}
