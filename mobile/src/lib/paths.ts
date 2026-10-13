/**
 * Las rutas de la web (avisos, enlaces compartidos) a pantallas de la app. Lo que la app no tiene
 * en nativo se abre en la web dentro de la app (`/web?path=…`).
 */
export function appRoute(webPath: string): string {
  const url = new URL(webPath, "https://doctordeck.app");
  const deck = url.pathname.match(/^\/decks\/([0-9a-f-]{36})$/i);
  if (deck) {
    const tab = url.searchParams.get("tab");
    return `/deck/${deck[1]}${tab === "missing" ? "?tab=missing" : ""}`;
  }
  const card = url.pathname.match(/^\/cards\/([0-9a-f-]{36})$/i);
  if (card) return `/card/${card[1]}`;
  if (url.pathname === "/notifications") return "/notifications";
  if (url.pathname === "/collection") return "/collection";
  if (url.pathname === "/decks") return "/decks";
  return `/web?path=${encodeURIComponent(url.pathname + url.search + url.hash)}`;
}
