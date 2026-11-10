"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import type {
  MyProfileDTO,
  NotificationsResponse,
  SavedDeckSummaryDTO,
  StatusResponse,
} from "@/server/dto";
import { GlobalSearch } from "./global-search";
import { clearCached, swr } from "./swr-cache";
import { api, storage } from "./api-client";
import { authClient } from "./auth-client";
import {
  IconActivity,
  IconBell,
  IconCart,
  IconCrown,
  IconLoan,
  IconSettings,
  IconUser,
  IconSwap,
  IconCollection,
  IconDecks,
  IconHome,
  IconLogin,
  IconLogout,
  IconMoon,
  IconMore,
  IconUsers,
  IconPlus,
  IconSun,
  Logo,
} from "./icons";
import {
  COLLECTION_EVENT,
  DECKS_EVENT,
  LOCAL_COLLECTION_EVENT,
  NOTIFICATIONS_EVENT,
  localCollection,
  localCopies,
} from "./local-collection";
import { LegalFooter } from "./legal";
import { LocalCollectionToAccount } from "./local-to-account";
import { ColorPips } from "./mana";
import { Dialog, useFormat } from "./ui";
import { goTo, LanguageSwitch, Link, type T, usePathname, useT } from "@/components/i18n";

type SessionUser = { name: string; email: string; username?: string | null };
const profileHref = (u: SessionUser) => (u.username ? `/u/${u.username}` : "/settings");

/**
 * Lee la ruta actual dentro de su propio <Suspense>: con Cache Components, en las rutas con
 * parámetros dinámicos (/decks/[id]) usePathname suspende durante el prerender. Mientras tanto se
 * pinta lo mismo sin marcar la sección activa.
 */
function WithPath({ children }: { children: (pathname: string) => ReactNode }) {
  return (
    <Suspense fallback={children("")}>
      <ReadPath>{children}</ReadPath>
    </Suspense>
  );
}
function ReadPath({ children }: { children: (pathname: string) => ReactNode }) {
  return <>{children(usePathname())}</>;
}

/**
 * Estructura de la app: arriba, lo público (secciones para explorar); al lado, lo tuyo (mazos,
 * colección, salir). En móvil (<760 px) el lateral desaparece y aparece la barra inferior.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const sessionUser = data?.user ?? null;
  const [username, setUsername] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Con sesión: mi nombre de usuario (perfil) y las notificaciones sin leer (cada minuto).
  useEffect(() => {
    if (!sessionUser) return;
    api<MyProfileDTO>("/api/me/profile", undefined, { silent: true })
      .then((p) => setUsername(p.username))
      .catch(() => setUsername(null));
    const poll = () =>
      api<NotificationsResponse>("/api/notifications", undefined, { silent: true })
        .then((n) => setUnread(n.unread))
        .catch(() => undefined);
    void poll();
    const t = setInterval(poll, 60_000);
    window.addEventListener(NOTIFICATIONS_EVENT, poll);
    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_EVENT, poll);
    };
  }, [sessionUser]);

  const user: SessionUser | null = sessionUser ? { ...sessionUser, username } : null;
  return (
    <div className="app">
      <WithPath>
        {(p) => <TopBar pathname={p} user={user} pending={isPending} unread={unread} />}
      </WithPath>
      <div className="shell">
        <WithPath>{(p) => <Sidebar user={user} pending={isPending} pathname={p} />}</WithPath>
        <div className="main">
          <LocalCollectionToAccount loggedIn={Boolean(sessionUser)} />
          {children}
          <LegalFooter />
          <WithPath>{(p) => <BottomNav pathname={p} user={user} />}</WithPath>
        </div>
      </div>
    </div>
  );
}

/** Páginas de cuenta (entrar, registro…): sin barras, centradas. */
export function BareShell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-[340px] flex-col gap-5">
        <Link href="/" className="brand fade justify-center" style={{ fontSize: 20 }}>
          <Logo size={30} />
          Doctor Deck
        </Link>
        {children}
        <p className="subtle fade text-center text-xs" style={{ ["--d" as string]: "160ms" }}>
          {t(
            "Contenido no oficial bajo la Fan Content Policy de Wizards of the Coast.",
            "Unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy.",
          )}
          <br />
          <Link href="/privacy">{t("Privacidad", "Privacy")}</Link> ·{" "}
          <Link href="/legal">{t("Aviso legal", "Legal notice")}</Link> · <LanguageSwitch />
        </p>
      </div>
    </div>
  );
}

async function signOut() {
  await authClient.signOut();
  // No dejar el mazo abierto ni lo cargado de la cuenta en un navegador compartido.
  storage.remove("deck-doctor:mazo");
  clearCached();
  goTo("/");
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const t = useT();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el tema lo fija el script del <head>
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-label={
        next === "light"
          ? t("Cambiar a tema claro", "Switch to light theme")
          : t("Cambiar a tema oscuro", "Switch to dark theme")
      }
      onClick={() => {
        document.documentElement.dataset.theme = next;
        storage.set("dd-theme", next);
        setTheme(next);
      }}
    >
      {theme === "light" ? <IconMoon /> : <IconSun />}
    </button>
  );
}

const initial = (u: SessionUser) => (u.name.trim()[0] ?? u.email[0] ?? "?").toUpperCase();

function TopBar({
  pathname,
  user,
  pending,
  unread,
}: {
  pathname: string;
  user: SessionUser | null;
  pending: boolean;
  unread: number;
}) {
  // "Inicio" ya es el logo. Con cuenta, los mazos (crear o importar está en «Nuevo mazo»); sin
  // ella, el analizador.
  const t = useT();
  const nav = [
    user
      ? { href: "/decks", label: t("Mis mazos", "My decks") }
      : { href: "/analyze", label: t("Analizar mazo", "Analyze a deck") },
    { href: "/cards", label: t("Cartas", "Cards") },
    { href: "/community", label: t("Comunidad", "Community") },
    { href: "/play", label: t("Jugar", "Play") },
  ];
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Logo />
        <span className="hide-sm">Doctor Deck</span>
      </Link>
      <nav className="topnav hide-sm" aria-label={t("Explorar", "Explore")}>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? "is-active" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch loggedIn={Boolean(user)} />
        <ThemeToggle />
        {user && (
          <Link
            href="/notifications"
            className="btn btn-ghost btn-icon relative"
            aria-label={
              unread > 0
                ? t(`Notificaciones (${unread} sin leer)`, `Notifications (${unread} unread)`)
                : t("Notificaciones", "Notifications")
            }
          >
            <IconBell />
            {unread > 0 && (
              <span
                className="absolute grid place-items-center rounded-full"
                style={{
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  // Rojo oscuro: con texto blanco de 10 px, el de los avisos no llega a 4,5:1.
                  background: "#c0352b",
                  color: "#fff",
                  font: "600 10px/1 var(--font-sans)",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        )}
        {pending ? (
          <span className="w-[30px]" />
        ) : user ? (
          <Link
            href={profileHref(user)}
            className="avatar"
            aria-label={`${t("Mi perfil", "My profile")} (${user.name})`}
            title={user.username ? `@${user.username}` : user.name}
          >
            {initial(user)}
          </Link>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost">
            {t("Entrar", "Sign in")}
          </Link>
        )}
      </div>
    </header>
  );
}

function Sidebar({
  user,
  pending,
  pathname,
}: {
  user: SessionUser | null;
  pending: boolean;
  pathname: string;
}) {
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[] | null>(null);
  const [copies, setCopies] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const t = useT();
  const { fmt } = useFormat();

  useEffect(() => {
    if (pending) return;
    const load = () => {
      if (user) {
        swr(
          "decks",
          () => api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true }),
          setDecks,
        ).catch(() => setDecks((d) => d ?? []));
        api<StatusResponse>("/api/status", undefined, { silent: true })
          .then((s) => setCopies(s.collection?.totalCards ?? 0))
          .catch(() => setCopies(null));
      } else {
        setCopies(localCopies(localCollection.get()));
      }
    };
    load();
    window.addEventListener(DECKS_EVENT, load);
    window.addEventListener(COLLECTION_EVENT, load);
    window.addEventListener(LOCAL_COLLECTION_EVENT, load);
    return () => {
      window.removeEventListener(DECKS_EVENT, load);
      window.removeEventListener(COLLECTION_EVENT, load);
      window.removeEventListener(LOCAL_COLLECTION_EVENT, load);
    };
  }, [user, pending]);

  const q = filter.trim().toLowerCase();
  const shown = (decks ?? []).filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.commanderNames.some((n) => n.toLowerCase().includes(q)),
  );

  return (
    <aside className="side" aria-label={t("Tu espacio", "Your space")}>
      {user && (
        <Link className={`nav ${pathname === "/decks" ? "is-active" : ""}`} href="/decks">
          <IconDecks />
          {t("Mis mazos", "My decks")}
          {decks && <span className="count">{decks.length}</span>}
        </Link>
      )}
      <Link className={`nav ${pathname === "/collection" ? "is-active" : ""}`} href="/collection">
        <IconCollection />
        {t("Mi colección", "My collection")}
        {copies !== null && <span className="count">{fmt(copies)}</span>}
      </Link>
      {!user && !pending && (
        <Link className={`nav ${pathname === "/decks/new" ? "is-active" : ""}`} href="/decks/new">
          <IconPlus />
          {t("Nuevo mazo", "New deck")}
        </Link>
      )}

      {user ? (
        <>
          <div className="side-head" style={{ marginTop: 16 }}>
            <span className="cap">{t("Mazos", "Decks")}</span>
            <Link
              className="btn btn-ghost btn-icon"
              href="/decks/new"
              aria-label={t("Nuevo mazo", "New deck")}
              style={{ width: 26, height: 26 }}
            >
              <IconPlus size={14} />
            </Link>
          </div>
          {decks && decks.length > 4 && (
            <input
              className="input"
              placeholder={t("Filtrar mazos…", "Filter decks…")}
              aria-label={t("Filtrar mazos", "Filter decks")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ height: 30, fontSize: 13 }}
            />
          )}
          <nav className="decklist" aria-label={t("Mazos guardados", "Saved decks")}>
            {decks?.length === 0 && (
              <p className="subtle px-2 text-[12.5px]">
                {t("Aún no has guardado ningún mazo.", "You haven't saved any decks yet.")}
              </p>
            )}
            {shown.map((d) => (
              <Link
                key={d.id}
                href={`/decks/${d.id}`}
                className={`deckrow ${pathname === `/decks/${d.id}` ? "is-active" : ""}`}
              >
                <ColorPips colors={d.colorIdentity} className="pips" />
                <span className="min-w-0">
                  <span className="nm">{d.name}</span>
                  <span className="cmd">{d.commanderNames.join(" + ")}</span>
                </span>
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <Link className={`nav ${pathname === "/feed" ? "is-active" : ""}`} href="/feed">
              <IconActivity />
              {t("Actividad", "Activity")}
            </Link>
            <Link
              className={`nav ${pathname.startsWith("/groups") ? "is-active" : ""}`}
              href="/groups"
            >
              <IconCrown />
              {t("Grupos y partidas", "Groups and games")}
            </Link>
            <Link className={`nav ${pathname === "/trades" ? "is-active" : ""}`} href="/trades">
              <IconSwap />
              {t("Intercambios", "Trades")}
            </Link>
            <Link className={`nav ${pathname === "/shopping" ? "is-active" : ""}`} href="/shopping">
              <IconCart />
              {t("Lista de compra", "Shopping list")}
            </Link>
            <Link className={`nav ${pathname === "/loans" ? "is-active" : ""}`} href="/loans">
              <IconLoan />
              {t("Préstamos", "Loans")}
            </Link>
            <Link className={`nav ${pathname === "/settings" ? "is-active" : ""}`} href="/settings">
              <IconSettings />
              {t("Ajustes", "Settings")}
            </Link>
            <button type="button" className="nav" onClick={() => void signOut()}>
              <IconLogout />
              {t("Salir", "Sign out")}
            </button>
          </div>
        </>
      ) : (
        !pending && (
          <div className="side-foot">
            <p className="subtle px-1 pb-2 text-[12.5px] leading-snug">
              {t(
                "Sin cuenta puedes analizar mazos; tu colección se queda en este navegador. Crea una cuenta para guardar mazos y llevar tu colección a cualquier dispositivo.",
                "Without an account you can analyze decks; your collection stays in this browser. Create an account to save decks and take your collection to any device.",
              )}
            </p>
            <Link href="/signup" className="btn">
              {t("Crear cuenta", "Create account")}
            </Link>
          </div>
        )
      )}
    </aside>
  );
}

/** Lo que no cabe en la barra inferior del móvil (con cuenta): en la hoja «Más». */
const moreLinks = (t: T) => [
  { href: "/decks/new", label: t("Nuevo mazo", "New deck"), icon: <IconPlus size={18} /> },
  { href: "/cards", label: t("Buscar cartas", "Search cards"), icon: <IconCollection size={18} /> },
  { href: "/community", label: t("Comunidad", "Community"), icon: <IconUsers size={18} /> },
  { href: "/feed", label: t("Actividad", "Activity"), icon: <IconActivity size={18} /> },
  {
    href: "/groups",
    label: t("Grupos y partidas", "Groups and games"),
    icon: <IconCrown size={18} />,
  },
  { href: "/trades", label: t("Intercambios", "Trades"), icon: <IconSwap size={18} /> },
  { href: "/shopping", label: t("Lista de compra", "Shopping list"), icon: <IconCart size={18} /> },
  { href: "/loans", label: t("Préstamos", "Loans"), icon: <IconLoan size={18} /> },
  { href: "/settings", label: t("Ajustes", "Settings"), icon: <IconSettings size={18} /> },
];

function BottomNav({ pathname, user }: { pathname: string; user: SessionUser | null }) {
  const [more, setMore] = useState(false);
  const t = useT();
  const MORE_LINKS = moreLinks(t);
  const items = user
    ? [
        {
          href: "/",
          label: t("Inicio", "Home"),
          icon: <IconHome size={20} />,
          active: pathname === "/",
        },
        {
          href: "/decks",
          label: t("Mazos", "Decks"),
          icon: <IconDecks size={20} />,
          active: pathname.startsWith("/decks") || pathname === "/analyze",
        },
        {
          href: "/collection",
          label: t("Colección", "Collection"),
          icon: <IconCollection size={20} />,
          active: pathname === "/collection",
        },
        {
          href: "/play",
          label: t("Jugar", "Play"),
          icon: <IconCrown size={20} />,
          active: pathname === "/play",
        },
      ]
    : [
        {
          href: "/",
          label: t("Inicio", "Home"),
          icon: <IconHome size={20} />,
          active: pathname === "/",
        },
        {
          href: "/analyze",
          label: t("Analizar", "Analyze"),
          icon: <IconDecks size={20} />,
          active: pathname === "/analyze",
        },
        {
          href: "/collection",
          label: t("Colección", "Collection"),
          icon: <IconCollection size={20} />,
          active: pathname === "/collection",
        },
        {
          href: "/play",
          label: t("Jugar", "Play"),
          icon: <IconCrown size={20} />,
          active: pathname === "/play",
        },
        {
          href: `/login?next=${encodeURIComponent(pathname)}`,
          label: t("Entrar", "Sign in"),
          icon: <IconLogin size={20} />,
          active: false,
        },
      ];
  const moreActive =
    user !== null &&
    (pathname === profileHref(user) ||
      MORE_LINKS.some((l) => l.href !== "/decks/new" && pathname.startsWith(l.href)));
  return (
    <>
      <nav className="bottomnav" aria-label={t("Principal", "Main")}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={i.active ? "is-active" : ""}>
            {i.icon}
            {i.label}
          </Link>
        ))}
        {user && (
          <button
            type="button"
            className={moreActive ? "is-active" : ""}
            aria-haspopup="dialog"
            onClick={() => setMore(true)}
          >
            <IconMore size={20} />
            {t("Más", "More")}
          </button>
        )}
      </nav>
      {/* Fuera de la barra: si no, hereda los estilos de sus enlaces. */}
      {user && (
        <Dialog open={more} onClose={() => setMore(false)} title={t("Más", "More")}>
          <nav className="morenav flex flex-col" aria-label={t("Más secciones", "More sections")}>
            <Link className="nav" href={profileHref(user)} onClick={() => setMore(false)}>
              <IconUser size={18} />
              {t("Mi perfil", "My profile")}{" "}
              {user.username ? <span className="subtle">@{user.username}</span> : null}
            </Link>
            {MORE_LINKS.map((l) => (
              <Link
                key={l.href}
                className={`nav ${pathname === l.href ? "is-active" : ""}`}
                href={l.href}
                onClick={() => setMore(false)}
              >
                {l.icon}
                {l.label}
              </Link>
            ))}
            <button type="button" className="nav" onClick={() => void signOut()}>
              <IconLogout size={18} />
              {t("Salir", "Sign out")}
            </button>
          </nav>
        </Dialog>
      )}
    </>
  );
}
