import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { localePath, LOCALES, type Locale } from "@/domain/i18n/locale";
import { getContainer } from "@/server/container";
import { siteUrl } from "@/server/share";

/** Uno por idioma (`/sitemap/es.xml`, `/sitemap/en.xml`): con los dos no caben en 50 000 URLs. */
export function generateSitemaps() {
  return LOCALES.map((id) => ({ id }));
}

/**
 * Páginas públicas, mazos públicos, perfiles con mazos públicos y fichas de cartas, en un idioma.
 * Cada URL lleva sus versiones en los demás (hreflang).
 */
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  await connection();
  const locale: Locale = (await props.id) === "en" ? "en" : "es";
  const base = siteUrl();
  const abs = (l: Locale, path: string) => new URL(localePath(l, path), base).toString();
  const entry = (path: string) => ({
    url: abs(locale, path),
    alternates: {
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, abs(l, path)])),
        "x-default": abs("es", path),
      },
    },
  });
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
    { ...entry("/"), changeFrequency: "weekly", priority: 1 },
    { ...entry("/community"), changeFrequency: "daily", priority: 0.8 },
    { ...entry("/analyze"), changeFrequency: "monthly", priority: 0.8 },
    { ...entry("/cards"), changeFrequency: "daily", priority: 0.8 },
    { ...entry("/decks/new"), changeFrequency: "monthly", priority: 0.7 },
    { ...entry("/collection"), changeFrequency: "monthly", priority: 0.7 },
    { ...entry("/play"), changeFrequency: "monthly", priority: 0.6 },
    { ...entry("/signup"), changeFrequency: "yearly", priority: 0.3 },
    { ...entry("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    { ...entry("/legal"), changeFrequency: "yearly", priority: 0.1 },
    { ...entry("/delete-account"), changeFrequency: "yearly", priority: 0.1 },
    ...decks.map((d) => ({
      ...entry(`/decks/${d.id}`),
      lastModified: d.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...cards.map((id) => ({
      ...entry(`/cards/${id}`),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...[...profiles].map(([username, updated]) => ({
      ...entry(`/u/${username}`),
      lastModified: updated,
      changeFrequency: "weekly" as const,
    })),
  ];
}
