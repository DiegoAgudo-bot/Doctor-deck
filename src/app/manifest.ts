import type { MetadataRoute } from "next";

/** PWA: se puede instalar desde el navegador del móvil ("Añadir a pantalla de inicio"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doctor Deck",
    short_name: "Doctor Deck",
    description: "Mejora tus mazos de Commander con las cartas que ya tienes",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e131b",
    theme_color: "#0e131b",
    categories: ["games", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Analizar un mazo", url: "/analyze" },
      { name: "Mi colección", url: "/collection" },
      { name: "Intercambios", url: "/trades" },
    ],
  };
}
