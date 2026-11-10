import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { localePath, LOCALE_COOKIE, splitLocale } from "@/domain/i18n/locale";

/**
 * Páginas que exigen cuenta (sin el prefijo de idioma). Comprobación optimista: si no hay cookie
 * de sesión, a /login. La real (sesión válida y dueño de los datos) la hace cada ruta de la API
 * con `requireUser`. Analizar mazos e importar la colección (al navegador) no exige cuenta.
 */
const PRIVATE =
  /^\/(decks|notifications|settings|trades|groups|feed|loans|shopping)$|^\/(trades|games|admin)\/|^\/groups\/(?!join\/)[^/]+$/;

/**
 * Idioma y sesión de cada página:
 * - `/es/…` lleva a `/…` (el español no lleva prefijo; una sola URL por página).
 * - Sin prefijo y con el inglés elegido (cookie `dd-lang`), a `/en/…`.
 * - Las privadas sin sesión, a `/login` (en su idioma).
 * - `/…` se sirve por dentro como `/es/…` (todas las páginas cuelgan de `app/[lang]`).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (/^\/es(\/|$)/.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  const { locale, path } = splitLocale(pathname);
  const prefixed = locale !== "es";

  if (!prefixed && request.cookies.get(LOCALE_COOKIE)?.value === "en") {
    return NextResponse.redirect(new URL(localePath("en", path) + search, request.url));
  }

  if (PRIVATE.test(path) && !getSessionCookie(request)) {
    const url = new URL(localePath(locale, "/login"), request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (prefixed) return NextResponse.next();
  return NextResponse.rewrite(
    new URL(`/es${pathname === "/" ? "" : pathname}${search}`, request.url),
  );
}

export const config = {
  // Todo menos la API, los ficheros de Next, las imágenes y lo que tiene extensión (robots.txt…).
  matcher: ["/((?!api/|_next/|img/|icons/|symbols/|\\.well-known/|.*\\.[a-zA-Z0-9]+$).*)"],
};
