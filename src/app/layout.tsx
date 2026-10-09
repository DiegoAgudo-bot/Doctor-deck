import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Deck Doctor",
  description: "Mejoras para tus mazos de Commander usando tu colección",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Tema antes de pintar (sin parpadeo): el elegido, o el del sistema.
const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("dd-theme")||"null");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plexSans.variable} ${plexMono.variable} ${spectral.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
