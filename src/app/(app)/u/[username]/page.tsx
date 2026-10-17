import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { ProfilePage } from "@/components/profile-page";
import { SITE_NAME } from "@/config/site";
import { profileShare, siteUrl } from "@/server/share";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = await profileShare((await params).username);
  if (!p) return { title: "Perfil · Doctor Deck", robots: { index: false } };
  const title = `${p.name} (@${p.username})`;
  const description =
    `${p.publicDecks} ${p.publicDecks === 1 ? "mazo público" : "mazos públicos"} de Commander` +
    (p.commanders.length > 0 ? `: ${p.commanders.join(", ")}` : "") +
    ". Sigue sus mazos e intercambia cartas en Doctor Deck.";
  return {
    metadataBase: siteUrl(),
    title: `${title} · Doctor Deck`,
    description,
    alternates: { canonical: `/u/${p.username}` },
    openGraph: { title, description, type: "profile", siteName: SITE_NAME, locale: "es_ES" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Perfil público: /u/{username}. El parámetro se lee dentro de Suspense (Cache Components). */
export default function Page({ params }: PageProps<"/u/[username]">) {
  return (
    <>
      <Suspense>
        <ProfilePage />
      </Suspense>
      <Suspense fallback={null}>
        <ProfileJsonLd params={params} />
      </Suspense>
    </>
  );
}

/** Datos estructurados del perfil (schema.org ProfilePage). */
async function ProfileJsonLd({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  await connection();
  const p = await profileShare((await params).username);
  if (!p) return null;
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: new URL(`/u/${p.username}`, base).toString(),
        mainEntity: {
          "@type": "Person",
          name: p.name,
          alternateName: `@${p.username}`,
          identifier: p.username,
        },
      }}
    />
  );
}
