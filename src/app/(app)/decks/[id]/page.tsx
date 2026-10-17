import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbs, JsonLd } from "@/components/json-ld";
import { SavedDeck } from "@/components/saved-deck";
import { SITE_NAME } from "@/config/site";
import { deckShare, siteUrl } from "@/server/share";

/** Título y vista previa al compartir el enlace (los privados no dicen nada). */
export async function generateMetadata({ params }: PageProps<"/decks/[id]">): Promise<Metadata> {
  const id = (await params).id;
  const deck = await deckShare(id);
  if (!deck) return { title: "Mazo · Doctor Deck", robots: { index: false } };
  const title = `${deck.name} · ${deck.commanders.join(" + ")}`;
  const description =
    `Mazo de Commander${deck.owner ? ` de @${deck.owner}` : ""}: ${deck.cardCount} cartas` +
    `${deck.bracket !== null ? `, bracket ${deck.bracket}` : ""}. Mira cuánto tienes ya en tu colección.`;
  return {
    metadataBase: siteUrl(),
    title: `${title} · Doctor Deck`,
    description,
    alternates: { canonical: `/decks/${id}` },
    openGraph: { title, description, type: "website", siteName: SITE_NAME, locale: "es_ES" },
    twitter: { card: "summary_large_image", title, description },
    // Los ocultos se abren con el enlace, pero no deben salir en buscadores.
    robots: deck.unlisted ? { index: false, follow: false } : undefined,
  };
}

/** Un mazo guardado: /decks/{uuid}. El id se lee dentro de Suspense (Cache Components). */
export default function SavedDeckPage({ params }: PageProps<"/decks/[id]">) {
  return (
    <>
      <Suspense>
        <SavedDeck />
      </Suspense>
      <Suspense fallback={null}>
        <DeckJsonLd params={params} />
      </Suspense>
    </>
  );
}

/** Datos estructurados de un mazo público (los ocultos no se indexan; los privados, nada). */
async function DeckJsonLd({ params }: Pick<PageProps<"/decks/[id]">, "params">) {
  await connection();
  const id = (await params).id;
  const deck = await deckShare(id);
  if (!deck || deck.unlisted) return null;
  const base = siteUrl();
  const url = new URL(`/decks/${id}`, base).toString();
  return (
    <JsonLd
      data={[
        breadcrumbs(base, [
          ["Inicio", "/"],
          ["Comunidad", "/community"],
          [deck.name, `/decks/${id}`],
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: deck.name,
          url,
          inLanguage: "es",
          genre: "Mazo de Commander (Magic: The Gathering)",
          about: deck.commanders.map((name) => ({ "@type": "Thing", name })),
          ...(deck.owner
            ? {
                author: {
                  "@type": "Person",
                  name: `@${deck.owner}`,
                  url: new URL(`/u/${deck.owner}`, base).toString(),
                },
              }
            : {}),
        },
      ]}
    />
  );
}
