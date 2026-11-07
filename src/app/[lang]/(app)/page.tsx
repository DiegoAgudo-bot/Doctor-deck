import type { Metadata } from "next";
import { Suspense } from "react";
import { Home } from "@/components/home";
import { Landing } from "@/components/landing";
import { LoadingText } from "@/components/loading-text";
import { Banner } from "@/components/ui";
import { hasSession, landingDecks } from "@/server/landing";
import { localeAlternates, paramLocale, tFor } from "@/server/i18n";
import { siteUrl } from "@/server/share";

// Título y descripción, los del layout raíz.
export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  return { alternates: localeAlternates(await paramLocale(params), "/") };
}

/**
 * Portada. Sin sesión, la landing se pinta en el servidor (está en el HTML desde el principio:
 * se ve antes y la leen los buscadores); con sesión, el panel (de cliente). La sesión se lee
 * dentro de <Suspense> (Cache Components).
 */
export default function HomePage({ params, searchParams }: PageProps<"/[lang]">) {
  return (
    <Suspense
      fallback={
        <main className="page">
          <LoadingText es="Cargando…" en="Loading…" />
        </main>
      }
    >
      <HomeOrLanding params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeOrLanding({
  params,
  searchParams,
}: Pick<PageProps<"/[lang]">, "params" | "searchParams">) {
  if (await hasSession()) return <Home />;
  // Si la comunidad no se puede leer, la portada sale igual (sin esa sección).
  const [decks, query, locale] = await Promise.all([
    landingDecks(3).catch(() => []),
    searchParams,
    paramLocale(params),
  ]);
  const t = tFor(locale);
  return (
    <main className="page">
      {query.account === "deleted" && (
        <Banner tone="info">
          {t(
            "Tu cuenta y todos tus datos se han borrado.",
            "Your account and all your data have been deleted.",
          )}
        </Banner>
      )}
      <Landing decks={decks} siteUrl={siteUrl()} locale={locale} />
    </main>
  );
}
