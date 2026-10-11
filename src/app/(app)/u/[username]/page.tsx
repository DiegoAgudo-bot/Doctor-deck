import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilePage } from "@/components/profile-page";
import { profileShare, siteUrl } from "@/server/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
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
    openGraph: { title, description, type: "profile", siteName: "Doctor Deck" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Perfil público: /u/{username}. El parámetro se lee dentro de Suspense (Cache Components). */
export default function Page() {
  return (
    <Suspense>
      <ProfilePage />
    </Suspense>
  );
}
