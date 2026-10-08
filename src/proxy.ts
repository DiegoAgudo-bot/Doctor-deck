import { NextResponse, type NextRequest } from "next/server";
import type { ApiErrorBody } from "@/server/dto";
import { appPassword, isPublicPath, isValidSession, SESSION_COOKIE } from "@/server/auth";

/** Exige sesión (ver server/auth.ts) en todo salvo el login, si hay APP_PASSWORD. */
export function proxy(request: NextRequest) {
  const password = appPassword();
  const { pathname, search } = request.nextUrl;
  if (!password || isPublicPath(pathname)) return NextResponse.next();
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value, password)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const body: ApiErrorBody = {
      error: { code: "unauthorized", message: "Sesión caducada: vuelve a entrar." },
    };
    return NextResponse.json(body, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo menos los estáticos de Next y el favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
