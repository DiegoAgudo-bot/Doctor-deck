const UUID = "[0-9a-f-]{36}";

/**
 * Las rutas de la web (avisos, enlaces compartidos) a pantallas de la app. Todo lo que tiene
 * página en la web tiene pantalla nativa; lo que no (privacidad, aviso legal, administración)
 * devuelve null y se abre en el navegador del sistema.
 */
export function appRoute(webPath: string): string | null {
  const url = new URL(webPath, "https://doctordeck.app");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const q = url.searchParams;
  const match = (re: string) => path.match(new RegExp(`^${re}$`, "i"));

  let m = match(`/decks/(${UUID})`);
  if (m) {
    const tab = q.get("tab");
    if (url.hash === "#comments") return `/deck-comments/${m[1]}`;
    return `/deck/${m[1]}${tab === "missing" ? "?tab=missing" : ""}`;
  }
  if ((m = match(`/cards/(${UUID})`))) return `/card/${m[1]}`;
  if ((m = match(`/groups/join/([A-Za-z0-9_-]{1,64})`))) return `/groups/join/${m[1]}`;
  if ((m = match(`/groups/(${UUID}|[A-Za-z0-9_-]{1,64})`))) return `/groups/${m[1]}`;
  if ((m = match(`/games/([A-Za-z0-9_-]{1,64})`))) return `/games/${m[1]}`;
  if ((m = match(`/trades/proposals/(${UUID})`))) return `/trades/proposals/${m[1]}`;
  if ((m = match(`/trades/with/([a-z0-9_.-]{1,40})`))) return `/trades/with/${m[1]}`;
  if ((m = match(`/u/([a-z0-9_.-]{1,40})`))) return `/u/${m[1]}`;
  if (path === "/trades") {
    const tab = q.get("tab");
    return tab && ["matches", "proposals", "wanted", "offered"].includes(tab)
      ? `/trades?tab=${tab}`
      : "/trades";
  }
  const simple: Record<string, string> = {
    "/": "/collection",
    "/notifications": "/notifications",
    "/collection": "/collection",
    "/decks": "/decks",
    "/decks/new": "/deck-new",
    "/cards": "/search",
    "/groups": "/groups",
    "/loans": "/loans",
    "/community": "/community",
    "/feed": "/feed",
    "/play": "/play",
    "/settings": "/settings",
  };
  return simple[path] ?? null;
}

/** Código de invitación de un grupo: del enlace (`…/groups/join/XYZ`) o pegado suelto. */
export function inviteCodeFrom(text: string): string | null {
  const t = text.trim();
  return (
    t.match(/\/groups\/join\/([A-Za-z0-9_-]{1,64})/)?.[1] ??
    (/^[A-Za-z0-9_-]{6,64}$/.test(t) ? t : null)
  );
}
