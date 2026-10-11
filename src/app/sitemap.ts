import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { siteUrl } from "@/server/share";

/** Portada, comunidad, mazos públicos y perfiles con mazos públicos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const decks = await getContainer().publicDecks.search({}, 5000);
  const owners = new Map<string, Date>();
  for (const d of decks) {
    const prev = owners.get(d.ownerId);
    if (!prev || d.updatedAt > prev) owners.set(d.ownerId, d.updatedAt);
  }
  const profiles = await Promise.all(
    [...owners].map(async ([id, updated]) => ({
      p: await getContainer().social.byId(id),
      updated,
    })),
  );
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/community"), changeFrequency: "daily", priority: 0.8 },
    ...decks.map((d) => ({
      url: url(`/decks/${d.id}`),
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...profiles.flatMap(({ p, updated }) =>
      p?.username
        ? [
            {
              url: url(`/u/${p.username}`),
              lastModified: updated,
              changeFrequency: "weekly" as const,
            },
          ]
        : [],
    ),
  ];
}
