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
      disallow: [
        "/api/",
        "/img/",
        "/settings",
        "/notifications",
        "/trades",
        "/collection",
        "/decks/new",
      ],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
