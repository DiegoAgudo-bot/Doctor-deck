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
import { api, storage } from "./api-client";
import { authClient } from "./auth-client";
import {
  IconBell,
  IconSettings,
  IconUser,
  IconSwap,
  IconUsers,
  IconCollection,
  IconDecks,
  IconHome,
  IconLogin,
  IconLogout,
  IconMoon,
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
import { ColorPips } from "./mana";
import { fmt } from "./ui";

type SessionUser = { name: string; email: string; username?: string | null };
const profileHref = (u: SessionUser) => (u.username ? `/u/${u.username}` : "/ajustes");

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
          Deck Doctor
        </Link>
        {children}
        <p className="subtle fade text-center text-xs" style={{ ["--d" as string]: "160ms" }}>
          Datos de cartas de Scryfall · Recomendaciones de EDHREC
          <br />
          Contenido no oficial bajo la Fan Content Policy de Wizards of the Coast.
        </p>
      </div>
    </div>
  );
}

async function signOut() {
  await authClient.signOut();
  storage.remove("deck-doctor:mazo"); // no dejar el mazo abierto en un navegador compartido
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
  const nav = [
    { href: "/", label: "Inicio" },
    { href: "/mazo", label: "Analizar mazo" },
    { href: "/comunidad", label: "Comunidad" },
  ];
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Logo />
        <span className="hide-sm">Deck Doctor</span>
      </Link>
      <nav className="topnav hide-sm" aria-label="Explorar">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? "is-active" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <Link
            href="/notificaciones"
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
                  background: "var(--color-out)",
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
          <Link href={`/entrar?next=${encodeURIComponent(pathname)}`} className="btn btn-primary">
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
        api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true })
          .then(setDecks)
          .catch(() => setDecks([]));
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
        <Link
          href={profileHref(user)}
          className={`deckrow ${pathname === profileHref(user) ? "is-active" : ""}`}
          style={{ gridTemplateColumns: "36px minmax(0, 1fr)", padding: 8, marginBottom: 8 }}
        >
          <span className="avatar" style={{ width: 36, height: 36, fontSize: 15 }}>
            {initial(user)}
          </span>
          <span className="min-w-0">
            <span className="nm" style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {user.name}
            </span>
            <span className="cmd">{user.username ? `@${user.username}` : "Mi perfil"}</span>
          </span>
        </Link>
      )}
      {user && (
        <Link className={`nav ${pathname === "/mazos" ? "is-active" : ""}`} href="/mazos">
          <IconDecks />
          Mis mazos
          {decks && <span className="count">{decks.length}</span>}
        </Link>
      )}
      <Link className={`nav ${pathname === "/coleccion" ? "is-active" : ""}`} href="/coleccion">
        <IconCollection />
        Mi colección
        {copies !== null && <span className="count">{fmt(copies)}</span>}
      </Link>

      {user ? (
        <>
          <div className="side-head" style={{ marginTop: 16 }}>
            <span className="cap">Mazos</span>
            <Link
              className="btn btn-ghost btn-icon"
              href="/mazos/nuevo"
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
            <Link
              className={`nav ${pathname === "/comunidad" ? "is-active" : ""}`}
              href="/comunidad"
            >
              <IconUsers />
              Comunidad
            </Link>
            <Link
              className={`nav ${pathname === "/intercambios" ? "is-active" : ""}`}
              href="/intercambios"
            >
              <IconSwap />
              Intercambios
            </Link>
            <Link className={`nav ${pathname === "/ajustes" ? "is-active" : ""}`} href="/ajustes">
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
            <Link href="/registro" className="btn btn-primary">
              Crear cuenta
            </Link>
            <Link className="nav" href={`/entrar?next=${encodeURIComponent(pathname)}`}>
              <IconLogin />
              Entrar
            </Link>
          </div>
        )
      )}
    </aside>
  );
}

function BottomNav({ pathname, user }: { pathname: string; user: SessionUser | null }) {
  const items = [
    { href: "/", label: "Inicio", icon: <IconHome size={20} /> },
    { href: "/mazo", label: "Analizar", icon: <IconPlus size={20} weight={1.8} /> },
    { href: "/comunidad", label: "Comunidad", icon: <IconUsers size={20} /> },
    { href: "/coleccion", label: "Colección", icon: <IconCollection size={20} /> },
    user
      ? { href: profileHref(user), label: "Perfil", icon: <IconUser size={20} /> }
      : {
          href: `/entrar?next=${encodeURIComponent(pathname)}`,
          label: "Entrar",
          icon: <IconLogin size={20} />,
        },
  ];
  return (
    <nav className="bottomnav" aria-label="Principal">
      {items.map((i) => (
        <Link key={i.label} href={i.href} className={pathname === i.href ? "is-active" : ""}>
          {i.icon}
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
