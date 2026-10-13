"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { ColorPips } from "./mana";
import { Dialog, fmt } from "./ui";

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
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-[340px] flex-col gap-5">
        <Link href="/" className="brand fade justify-center" style={{ fontSize: 20 }}>
          <Logo size={30} />
          Doctor Deck
        </Link>
        {children}
        <p className="subtle fade text-center text-xs" style={{ ["--d" as string]: "160ms" }}>
          Datos de cartas de Scryfall · Recomendaciones de EDHREC
          <br />
          Contenido no oficial bajo la Fan Content Policy de Wizards of the Coast.
          <br />
          <Link href="/privacy">Privacidad</Link> · <Link href="/legal">Aviso legal</Link>
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
  window.location.assign(new URL("/", window.location.origin));
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el tema lo fija el script del <head>
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-label={next === "light" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
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
  const nav = [
    user ? { href: "/decks", label: "Mis mazos" } : { href: "/analyze", label: "Analizar mazo" },
    { href: "/cards", label: "Cartas" },
    { href: "/community", label: "Comunidad" },
    { href: "/play", label: "Jugar" },
  ];
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Logo />
        <span className="hide-sm">Doctor Deck</span>
      </Link>
      <nav className="topnav hide-sm" aria-label="Explorar">
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
            aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
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
            aria-label={`Mi perfil (${user.name})`}
            title={user.username ? `@${user.username}` : user.name}
          >
            {initial(user)}
          </Link>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost">
            Entrar
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
    <aside className="side" aria-label="Tu espacio">
      {user && (
        <Link className={`nav ${pathname === "/decks" ? "is-active" : ""}`} href="/decks">
          <IconDecks />
          Mis mazos
          {decks && <span className="count">{decks.length}</span>}
        </Link>
      )}
      <Link className={`nav ${pathname === "/collection" ? "is-active" : ""}`} href="/collection">
        <IconCollection />
        Mi colección
        {copies !== null && <span className="count">{fmt(copies)}</span>}
      </Link>
      {!user && !pending && (
        <Link className={`nav ${pathname === "/decks/new" ? "is-active" : ""}`} href="/decks/new">
          <IconPlus />
          Nuevo mazo
        </Link>
      )}

      {user ? (
        <>
          <div className="side-head" style={{ marginTop: 16 }}>
            <span className="cap">Mazos</span>
            <Link
              className="btn btn-ghost btn-icon"
              href="/decks/new"
              aria-label="Nuevo mazo"
              style={{ width: 26, height: 26 }}
            >
              <IconPlus size={14} />
            </Link>
          </div>
          {decks && decks.length > 4 && (
            <input
              className="input"
              placeholder="Filtrar mazos…"
              aria-label="Filtrar mazos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ height: 30, fontSize: 13 }}
            />
          )}
          <nav className="decklist" aria-label="Mazos guardados">
            {decks?.length === 0 && (
              <p className="subtle px-2 text-[12.5px]">Aún no has guardado ningún mazo.</p>
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
              Actividad
            </Link>
            <Link
              className={`nav ${pathname.startsWith("/groups") ? "is-active" : ""}`}
              href="/groups"
            >
              <IconCrown />
              Grupos y partidas
            </Link>
            <Link className={`nav ${pathname === "/trades" ? "is-active" : ""}`} href="/trades">
              <IconSwap />
              Intercambios
            </Link>
            <Link className={`nav ${pathname === "/loans" ? "is-active" : ""}`} href="/loans">
              <IconLoan />
              Préstamos
            </Link>
            <Link className={`nav ${pathname === "/settings" ? "is-active" : ""}`} href="/settings">
              <IconSettings />
              Ajustes
            </Link>
            <button type="button" className="nav" onClick={() => void signOut()}>
              <IconLogout />
              Salir
            </button>
          </div>
        </>
      ) : (
        !pending && (
          <div className="side-foot">
            <p className="subtle px-1 pb-2 text-[12.5px] leading-snug">
              Sin cuenta puedes analizar mazos; tu colección se queda en este navegador. Crea una
              cuenta para guardar mazos y llevar tu colección a cualquier dispositivo.
            </p>
            <Link href="/signup" className="btn">
              Crear cuenta
            </Link>
          </div>
        )
      )}
    </aside>
  );
}

/** Lo que no cabe en la barra inferior del móvil (con cuenta): en la hoja «Más». */
const MORE_LINKS = [
  { href: "/decks/new", label: "Nuevo mazo", icon: <IconPlus size={18} /> },
  { href: "/cards", label: "Buscar cartas", icon: <IconCollection size={18} /> },
  { href: "/community", label: "Comunidad", icon: <IconUsers size={18} /> },
  { href: "/feed", label: "Actividad", icon: <IconActivity size={18} /> },
  { href: "/groups", label: "Grupos y partidas", icon: <IconCrown size={18} /> },
  { href: "/trades", label: "Intercambios", icon: <IconSwap size={18} /> },
  { href: "/loans", label: "Préstamos", icon: <IconLoan size={18} /> },
  { href: "/settings", label: "Ajustes", icon: <IconSettings size={18} /> },
];

function BottomNav({ pathname, user }: { pathname: string; user: SessionUser | null }) {
  const [more, setMore] = useState(false);
  const items = user
    ? [
        { href: "/", label: "Inicio", icon: <IconHome size={20} />, active: pathname === "/" },
        {
          href: "/decks",
          label: "Mazos",
          icon: <IconDecks size={20} />,
          active: pathname.startsWith("/decks") || pathname === "/analyze",
        },
        {
          href: "/collection",
          label: "Colección",
          icon: <IconCollection size={20} />,
          active: pathname === "/collection",
        },
        {
          href: "/play",
          label: "Jugar",
          icon: <IconCrown size={20} />,
          active: pathname === "/play",
        },
      ]
    : [
        { href: "/", label: "Inicio", icon: <IconHome size={20} />, active: pathname === "/" },
        {
          href: "/analyze",
          label: "Analizar",
          icon: <IconDecks size={20} />,
          active: pathname === "/analyze",
        },
        {
          href: "/collection",
          label: "Colección",
          icon: <IconCollection size={20} />,
          active: pathname === "/collection",
        },
        {
          href: "/play",
          label: "Jugar",
          icon: <IconCrown size={20} />,
          active: pathname === "/play",
        },
        {
          href: `/login?next=${encodeURIComponent(pathname)}`,
          label: "Entrar",
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
      <nav className="bottomnav" aria-label="Principal">
        {items.map((i) => (
          <Link key={i.label} href={i.href} className={i.active ? "is-active" : ""}>
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
            Más
          </button>
        )}
      </nav>
      {/* Fuera de la barra: si no, hereda los estilos de sus enlaces. */}
      {user && (
        <Dialog open={more} onClose={() => setMore(false)} title="Más">
          <nav className="morenav flex flex-col" aria-label="Más secciones">
            <Link className="nav" href={profileHref(user)} onClick={() => setMore(false)}>
              <IconUser size={18} />
              Mi perfil {user.username ? <span className="subtle">@{user.username}</span> : null}
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
              Salir
            </button>
          </nav>
        </Dialog>
      )}
    </>
  );
}
