import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedDeck } from "@/components/saved-deck";
import { deckShare, siteUrl } from "@/server/share";

/** Título y vista previa al compartir el enlace (los privados no dicen nada). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const deck = await deckShare((await params).id);
  if (!deck) return { title: "Mazo · Doctor Deck", robots: { index: false } };
  const title = `${deck.name} · ${deck.commanders.join(" + ")}`;
  const description =
    `Mazo de Commander${deck.owner ? ` de @${deck.owner}` : ""}: ${deck.cardCount} cartas` +
    `${deck.bracket !== null ? `, bracket ${deck.bracket}` : ""}. Mira cuánto tienes ya en tu colección.`;
  return {
    metadataBase: siteUrl(),
    title: `${title} · Doctor Deck`,
    description,
    openGraph: { title, description, type: "website", siteName: "Doctor Deck" },
    twitter: { card: "summary_large_image", title, description },
    // Los ocultos se abren con el enlace, pero no deben salir en buscadores.
    robots: deck.unlisted ? { index: false, follow: false } : undefined,
  };
}

/** Un mazo guardado: /decks/{uuid}. El id se lee dentro de Suspense (Cache Components). */
export default function SavedDeckPage() {
  return (
    <Suspense>
      <SavedDeck />
    </Suspense>
  );
}
