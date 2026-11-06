import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { ProfilePage } from "@/components/profile-page";
import { SITE_NAME } from "@/config/site";
import { localePath } from "@/domain/i18n/locale";
import { localeAlternates, paramLocale, tFor } from "@/server/i18n";
import { profileShare, siteUrl } from "@/server/share";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/u/[username]">): Promise<Metadata> {
  const p = await profileShare((await params).username);
  const locale = await paramLocale(params);
  const t = tFor(locale);
  if (!p) return { title: `${t("Perfil", "Profile")} · Doctor Deck`, robots: { index: false } };
  const title = `${p.name} (@${p.username})`;
  const cmd = p.commanders.length > 0 ? `: ${p.commanders.join(", ")}` : "";
  const description =
    p.publicDecks === 1
      ? t(`1 mazo público de Commander${cmd}.`, `1 public Commander deck${cmd}.`)
      : t(
          `${p.publicDecks} mazos públicos de Commander${cmd}.`,
          `${p.publicDecks} public Commander decks${cmd}.`,
        );
  const tail = t(
    " Sigue sus mazos e intercambia cartas en Doctor Deck.",
    " Follow their decks and trade cards on Doctor Deck.",
  );
  return {
    metadataBase: siteUrl(),
    title: `${title} · Doctor Deck`,
    description: description + tail,
    alternates: localeAlternates(locale, `/u/${p.username}`),
    openGraph: {
      title,
      description: description + tail,
      type: "profile",
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_GB" : "es_ES",
    },
    twitter: { card: "summary_large_image", title, description: description + tail },
  };
}

/** Perfil público: /u/{username}. El parámetro se lee dentro de Suspense (Cache Components). */
export default function Page({ params }: PageProps<"/[lang]/u/[username]">) {
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
async function ProfileJsonLd({ params }: Pick<PageProps<"/[lang]/u/[username]">, "params">) {
  await connection();
  const p = await profileShare((await params).username);
  if (!p) return null;
  const base = siteUrl();
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: new URL(localePath(await paramLocale(params), `/u/${p.username}`), base).toString(),
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
