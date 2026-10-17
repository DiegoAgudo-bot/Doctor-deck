import type { Metadata } from "next";
import { Suspense } from "react";
import { Home } from "@/components/home";
import { Landing } from "@/components/landing";
import { Banner, Loading } from "@/components/ui";
import { hasSession, landingDecks } from "@/server/landing";
import { siteUrl } from "@/server/share";

// Título y descripción, los del layout raíz.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Portada. Sin sesión, la landing se pinta en el servidor (está en el HTML desde el principio:
 * se ve antes y la leen los buscadores); con sesión, el panel (de cliente). La sesión se lee
 * dentro de <Suspense> (Cache Components).
 */
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense
      fallback={
        <main className="page">
          <Loading>Cargando…</Loading>
        </main>
      }
    >
      <HomeOrLanding searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeOrLanding({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  if (await hasSession()) return <Home />;
  // Si la comunidad no se puede leer, la portada sale igual (sin esa sección).
  const [decks, params] = await Promise.all([landingDecks(3).catch(() => []), searchParams]);
  return (
    <main className="page">
      {params.account === "deleted" && (
        <Banner tone="info">Tu cuenta y todos tus datos se han borrado.</Banner>
      )}
      <Landing decks={decks} siteUrl={siteUrl()} />
    </main>
  );
}
