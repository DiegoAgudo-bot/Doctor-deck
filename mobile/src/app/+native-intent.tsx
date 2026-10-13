import { appRoute } from "~/lib/paths";

/**
 * Enlaces que abren la app: lo compartido (`doctordeck://dataUrl=…`, lo recoge el layout), la
 * vuelta del login con Google y los enlaces https://doctordeck.app/decks/… o /cards/….
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes("dataUrl=")) return "/";
    if (path.startsWith("https://")) {
      const url = new URL(path);
      return appRoute(url.pathname + url.search);
    }
    if (path.startsWith("doctordeck://")) return "/";
    return path;
  } catch {
    return "/";
  }
}
