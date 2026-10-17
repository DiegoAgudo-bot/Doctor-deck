import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CardDetailPage } from "@/components/cards-pages";
import { breadcrumbs, JsonLd } from "@/components/json-ld";
import { Loading } from "@/components/ui";
import { SITE_NAME } from "@/config/site";
import { publicCardDetail } from "@/server/card-page";
import { cardDescription } from "@/server/seo";
import { siteUrl } from "@/server/share";

/** Título, descripción y canónica con los datos de la carta (para compartir y buscadores). */
export async function generateMetadata({ params }: PageProps<"/cards/[id]">): Promise<Metadata> {
  // Se lee de la BD en cada petición (no en el build).
  await connection();
  const d = await publicCardDetail((await params).id.slice(0, 64));
  if (!d) return { title: `Carta · ${SITE_NAME}`, robots: { index: false } };
  const title = `${d.card.name}: precio, ediciones y mazos de Commander`;
  const description = cardDescription(d);
  return {
    metadataBase: siteUrl(),
    title: `${title} · ${SITE_NAME}`,
    description,
    alternates: { canonical: `/cards/${d.card.oracleId}` },
    openGraph: {
      title: d.card.name,
      description,
      type: "website",
      siteName: SITE_NAME,
      locale: "es_ES",
      url: `/cards/${d.card.oracleId}`,
    },
    twitter: { card: "summary_large_image", title: d.card.name, description },
  };
}

/**
 * Ficha de una carta: /cards/{oracleId}. Se pinta en el servidor con los datos públicos (está en
 * el HTML para los buscadores); con sesión, el cliente la vuelve a pedir con mis copias.
 */
export default function Page({ params }: PageProps<"/cards/[id]">) {
  return (
    <Suspense
      fallback={
        <main className="page">
          <Loading>Cargando la carta…</Loading>
        </main>
      }
    >
      <CardDetail params={params} />
    </Suspense>
  );
}

async function CardDetail({ params }: Pick<PageProps<"/cards/[id]">, "params">) {
  await connection();
  const d = await publicCardDetail((await params).id.slice(0, 64));
  if (!d) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbs(siteUrl(), [
          ["Inicio", "/"],
          ["Cartas", "/cards"],
          [d.card.name, `/cards/${d.card.oracleId}`],
        ])}
      />
      <CardDetailPage key={d.card.oracleId} initial={d} />
    </>
  );
}
