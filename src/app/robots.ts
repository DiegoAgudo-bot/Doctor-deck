import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/server/share";

/** Buscadores: lo público sí; la API y las páginas personales, no. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Lo personal (exige cuenta) no se rastrea; además lleva `noindex`. `$`: solo la lista de
      // mis mazos, no los mazos públicos (/decks/{id}).
      disallow: [
        "/api/",
        "/img/",
        "/admin/",
        "/settings",
        "/notifications",
        "/trades",
        "/feed",
        "/groups",
        "/games/",
        "/loans",
        "/decks$",
        "/login",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
