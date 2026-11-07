import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CardDetailPage } from "@/components/cards-pages";
import { breadcrumbs, JsonLd } from "@/components/json-ld";
import { LoadingText } from "@/components/loading-text";
import { SITE_NAME } from "@/config/site";
import { publicCardDetail } from "@/server/card-page";
import { localePath } from "@/domain/i18n/locale";
import { localeAlternates, paramLocale, tFor } from "@/server/i18n";
import { cardDescription } from "@/server/seo";
import { siteUrl } from "@/server/share";

/** Título, descripción y canónica con los datos de la carta (para compartir y buscadores). */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/cards/[id]">): Promise<Metadata> {
  // Se lee de la BD en cada petición (no en el build).
  await connection();
  const d = await publicCardDetail((await params).id.slice(0, 64));
  const locale = await paramLocale(params);
  const t = tFor(locale);
  if (!d) return { title: `${t("Carta", "Card")} · ${SITE_NAME}`, robots: { index: false } };
  const title = t(
    `${d.card.name}: precio, ediciones y mazos de Commander`,
    `${d.card.name}: price, printings and Commander decks`,
  );
  const description = cardDescription(d, locale);
  const path = `/cards/${d.card.oracleId}`;
  return {
    metadataBase: siteUrl(),
    title: `${title} · ${SITE_NAME}`,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: d.card.name,
      description,
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_GB" : "es_ES",
      url: localePath(locale, path),
    },
    twitter: { card: "summary_large_image", title: d.card.name, description },
  };
}

/**
 * Ficha de una carta: /cards/{oracleId}. Se pinta en el servidor con los datos públicos (está en
 * el HTML para los buscadores); con sesión, el cliente la vuelve a pedir con mis copias.
 */
export default function Page({ params }: PageProps<"/[lang]/cards/[id]">) {
  return (
    <Suspense
      fallback={
        <main className="page">
          <LoadingText es="Cargando la carta…" en="Loading the card…" />
        </main>
      }
    >
      <CardDetail params={params} />
    </Suspense>
  );
}

async function CardDetail({ params }: Pick<PageProps<"/[lang]/cards/[id]">, "params">) {
  await connection();
  const d = await publicCardDetail((await params).id.slice(0, 64));
  if (!d) notFound();
  const locale = await paramLocale(params);
  const t = tFor(locale);
  const lp = (p: string) => localePath(locale, p);
  return (
    <>
      <JsonLd
        data={breadcrumbs(siteUrl(), [
          [t("Inicio", "Home"), lp("/")],
          [t("Cartas", "Cards"), lp("/cards")],
          [d.card.name, lp(`/cards/${d.card.oracleId}`)],
        ])}
      />
      <CardDetailPage key={d.card.oracleId} initial={d} />
    </>
  );
}
