import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbs, JsonLd } from "@/components/json-ld";
import { SavedDeck } from "@/components/saved-deck";
import { SITE_NAME } from "@/config/site";
import { localePath } from "@/domain/i18n/locale";
import { localeAlternates, paramLocale, tFor } from "@/server/i18n";
import { deckShare, siteUrl } from "@/server/share";

/** Título y vista previa al compartir el enlace (los privados no dicen nada). */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/decks/[id]">): Promise<Metadata> {
  const id = (await params).id;
  const deck = await deckShare(id);
  const locale = await paramLocale(params);
  const t = tFor(locale);
  if (!deck) return { title: `${t("Mazo", "Deck")} · Doctor Deck`, robots: { index: false } };
  const title = `${deck.name} · ${deck.commanders.join(" + ")}`;
  const by = deck.owner ? t(` de @${deck.owner}`, ` by @${deck.owner}`) : "";
  const bracket = deck.bracket !== null ? `, bracket ${deck.bracket}` : "";
  const description = t(
    `Mazo de Commander${by}: ${deck.cardCount} cartas${bracket}. Mira cuánto tienes ya en tu colección.`,
    `Commander deck${by}: ${deck.cardCount} cards${bracket}. See how much of it you already own.`,
  );
  return {
    metadataBase: siteUrl(),
    title: `${title} · Doctor Deck`,
    description,
    alternates: localeAlternates(locale, `/decks/${id}`),
    openGraph: {
      title,
      description,
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_GB" : "es_ES",
    },
    twitter: { card: "summary_large_image", title, description },
    // Los ocultos se abren con el enlace, pero no deben salir en buscadores.
    robots: deck.unlisted ? { index: false, follow: false } : undefined,
  };
}

/** Un mazo guardado: /decks/{uuid}. El id se lee dentro de Suspense (Cache Components). */
export default function SavedDeckPage({ params }: PageProps<"/[lang]/decks/[id]">) {
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
async function DeckJsonLd({ params }: Pick<PageProps<"/[lang]/decks/[id]">, "params">) {
  await connection();
  const id = (await params).id;
  const deck = await deckShare(id);
  if (!deck || deck.unlisted) return null;
  const base = siteUrl();
  const locale = await paramLocale(params);
  const t = tFor(locale);
  const lp = (p: string) => localePath(locale, p);
  const url = new URL(lp(`/decks/${id}`), base).toString();
  return (
    <JsonLd
      data={[
        breadcrumbs(base, [
          [t("Inicio", "Home"), lp("/")],
          [t("Comunidad", "Community"), lp("/community")],
          [deck.name, lp(`/decks/${id}`)],
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: deck.name,
          url,
          inLanguage: locale,
          genre: t(
            "Mazo de Commander (Magic: The Gathering)",
            "Commander deck (Magic: The Gathering)",
          ),
          about: deck.commanders.map((name) => ({ "@type": "Thing", name })),
          ...(deck.owner
            ? {
                author: {
                  "@type": "Person",
                  name: `@${deck.owner}`,
                  url: new URL(lp(`/u/${deck.owner}`), base).toString(),
                },
              }
            : {}),
        },
      ]}
    />
  );
}
