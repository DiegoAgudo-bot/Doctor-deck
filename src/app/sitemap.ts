import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { siteUrl } from "@/server/share";

/** Portada, comunidad, mazos públicos, perfiles con mazos públicos y fichas de cartas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const c = getContainer();
  // Un sitemap admite 50 000 URLs: mazos, perfiles y las fichas de las cartas más jugadas.
  const [decks, cards] = await Promise.all([
    c.publicDecks.sitemapEntries(5000),
    c.cards.sitemapCards(30_000),
  ]);
  const profiles = new Map<string, Date>();
  for (const d of decks) {
    const prev = profiles.get(d.username);
    if (!prev || d.updatedAt > prev) profiles.set(d.username, d.updatedAt);
  }
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/community"), changeFrequency: "daily", priority: 0.8 },
    ...decks.map((d) => ({
      url: url(`/decks/${d.id}`),
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...cards.map((id) => ({
      url: url(`/cards/${id}`),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...[...profiles].map(([username, updated]) => ({
      url: url(`/u/${username}`),
      lastModified: updated,
      changeFrequency: "weekly" as const,
    })),
  ];
}
