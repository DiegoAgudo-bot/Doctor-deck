import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deck Doctor",
  description: "Mejoras para tus mazos de Commander usando solo tu colección",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/coleccion", label: "Colección" },
  { href: "/mazo", label: "Mazo" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-background/95 backdrop-blur dark:border-zinc-800">
          <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-2">
            <span className="mr-auto font-semibold">🩺 Deck Doctor</span>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
