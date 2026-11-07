import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import Script from "next/script";
import { ErrorReporter } from "@/components/error-reporter";
import { LocaleProvider } from "@/components/i18n";
import { ServiceWorker } from "@/components/service-worker";
import { publicSiteUrl, SITE_NAME } from "@/config/site";
import { isLocale, LOCALES, pick } from "@/domain/i18n/locale";
import "../globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});
// Solo para texto de cartas.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-spectral",
});

const DESCRIPTION = {
  es: "Mejora tus mazos de Commander (Magic: The Gathering) con las cartas que ya tienes: cambios 1×1 con lo que juega la comunidad, tu colección, combos, precios e intercambios.",
  en: "Upgrade your Commander decks (Magic: The Gathering) with the cards you already own: 1-for-1 swaps based on what the community plays, your collection, combos, prices and trades.",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Las páginas que no dicen otra cosa heredan esto. La canónica no va aquí: cada página pública
// pone la suya (si estuviera aquí, todas apuntarían a la portada); sí los idiomas de la portada.
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "es";
  const t = (es: string, en: string) => pick(locale, es, en);
  const description = DESCRIPTION[locale];
  return {
    metadataBase: publicSiteUrl(),
    title: t(
      `${SITE_NAME}: mejora tus mazos de Commander con tu colección`,
      `${SITE_NAME}: upgrade your Commander decks with your collection`,
    ),
    description,
    applicationName: SITE_NAME,
    keywords:
      locale === "en"
        ? [
            "Commander",
            "EDH",
            "Magic: The Gathering",
            "Commander deck builder",
            "MTG collection tracker",
            "MTG card prices",
            "MTG trading",
          ]
        : [
            "Commander",
            "EDH",
            "Magic: The Gathering",
            "mazos de Commander",
            "colección de Magic",
            "precios de cartas",
            "intercambio de cartas",
          ],
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "en" ? "en_GB" : "es_ES",
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_GB"],
      title: SITE_NAME,
      description,
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon: [
        { url: "/icons/favicon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
  ],
};

// Tema antes de pintar (sin parpadeo): el elegido, o el del sistema.
const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("dd-theme")||"null");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html
      lang={lang}
      className={`${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <ErrorReporter />
        <ServiceWorker />
        <LocaleProvider locale={lang}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
