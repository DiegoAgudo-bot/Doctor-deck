import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { LOCALES } from "@/domain/i18n/locale";
import { siteUrl } from "@/server/share";

/** Buscadores: lo público sí; la API y las páginas personales, no. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Lo personal (exige cuenta) no se rastrea, en los dos idiomas; además lleva `noindex`. `$`: solo la lista de
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
        "/shopping",
        "/decks$",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/en/admin/",
        "/en/settings",
        "/en/notifications",
        "/en/trades",
        "/en/feed",
        "/en/groups",
        "/en/games/",
        "/en/loans",
        "/en/shopping",
        "/en/decks$",
        "/en/login",
        "/en/forgot-password",
        "/en/reset-password",
      ],
    },
    sitemap: LOCALES.map((l) => new URL(`/sitemap/${l}.xml`, base).toString()),
  };
}
