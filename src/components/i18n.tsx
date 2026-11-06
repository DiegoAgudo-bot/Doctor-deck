"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  type ComponentProps,
} from "react";
import {
  DEFAULT_LOCALE,
  intlLocale,
  LOCALE_COOKIE,
  localePath,
  pick,
  splitLocale,
  type Locale,
} from "@/domain/i18n/locale";

/*
 * Idioma en los componentes de cliente. Los textos van en los dos idiomas junto al código:
 * `const t = useT(); t("Colección", "Collection")`. Así nada se queda sin traducir por una clave
 * olvidada y quien lee el componente ve los dos textos.
 */

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = () => useContext(LocaleContext);

/** Elige el texto en el idioma de la página. */
export type T = (es: string, en: string) => string;

export function useT(): T {
  const locale = useLocale();
  return useCallback((es: string, en: string) => pick(locale, es, en), [locale]);
}

/** `/cards` → `/en/cards` en inglés; en español, igual. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return useCallback((path: string) => localePath(locale, path), [locale]);
}

/** Números y fechas con el formato del idioma (`es-ES` / `en-GB`). */
export function useIntlLocale(): string {
  return intlLocale(useLocale());
}

/**
 * Navegación completa (recarga la página) a una ruta propia en el idioma de la página actual.
 * Solo en el navegador, desde eventos.
 */
export function goTo(path: string) {
  const { locale } = splitLocale(window.location.pathname);
  window.location.assign(new URL(localePath(locale, path), window.location.origin));
}

/** `next/link` que añade el idioma a las rutas propias (`/cards` → `/en/cards`). */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const lp = useLocalePath();
  const localized =
    typeof href === "string"
      ? lp(href)
      : href.pathname
        ? { ...href, pathname: lp(href.pathname) }
        : href;
  return <NextLink href={localized} {...props} />;
}

/** `useRouter` de Next con `push`/`replace`/`prefetch` en el idioma de la página. */
export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const lp = useLocalePath();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => router.push(lp(href), options),
      replace: (href, options) => router.replace(lp(href), options),
      prefetch: (href, options) => router.prefetch(lp(href), options),
    }),
    [router, lp],
  );
}

/**
 * Ruta actual sin el idioma (`/en/cards` y `/cards` → `/cards`). En el servidor Next da la ruta
 * de dentro (`/es/cards`) y en el navegador la de fuera; así coinciden.
 */
export function usePathname(): string {
  return splitLocale(useNextPathname() ?? "/").path;
}

/**
 * Enlace a esta misma página en el otro idioma. Recuerda la elección (cookie `dd-lang`, que el
 * proxy usa para llevar a `/en/…` a quien entra por una URL en español) y recarga entera: cada
 * idioma tiene su propio layout raíz.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  // La ruta se lee dentro de <Suspense> (Cache Components); mientras, a la portada del otro idioma.
  return (
    <Suspense fallback={<SwitchLink path="/" className={className} />}>
      <SwitchHere className={className} />
    </Suspense>
  );
}

function SwitchHere({ className }: { className: string }) {
  return <SwitchLink path={usePathname()} className={className} />;
}

function SwitchLink({ path, className }: { path: string; className: string }) {
  const locale = useLocale();
  const other: Locale = locale === "en" ? "es" : "en";
  const href = localePath(other, path);
  return (
    <a
      href={href}
      hrefLang={other}
      lang={other}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        const here = localePath(other, splitLocale(window.location.pathname).path);
        window.location.assign(here + window.location.search);
      }}
    >
      {other === "en" ? "English" : "Español"}
    </a>
  );
}
