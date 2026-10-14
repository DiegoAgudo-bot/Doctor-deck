"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChangePassword, OpenSessions } from "./account-security";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  NOTIFICATION_GROUP_KEYS,
  type NotificationGroup,
} from "@/domain/social/notification-prefs";
import { USERNAME_HELP } from "@/domain/social/username";
import type { MyProfileDTO } from "@/server/dto";
import type { MemberDTO } from "@/server/social-dto";
import { clearCached } from "./swr-cache";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { IconLogout } from "./icons";
import { Banner, Loading } from "./ui";

/**
 * Cuenta: email verificado o no (con reenvío del enlace) y cuentas vinculadas (Google). Vincular
 * con sesión es la forma segura de unir Google a una cuenta creada con contraseña.
 */
function AccountSection({ google, mail }: { google: boolean; mail: boolean }) {
  const { data: session, refetch } = authClient.useSession();
  const [providers, setProviders] = useState<string[] | null>(null);
  const linkError = useSearchParams().get("linkError");
  const [note, setNote] = useState<{ tone: "in" | "out"; text: string } | null>(
    linkError
      ? {
          tone: "out",
          text: "No se ha podido vincular Google. Comprueba que usas la cuenta de Google con el mismo email (o que no está ya vinculada a otro usuario).",
        }
      : null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void authClient.listAccounts().then(({ data }) => {
      setProviders((data ?? []).map((a) => a.providerId));
    });
  }, []);

  if (!session) return null;
  const verified = session.user.emailVerified;
  const hasGoogle = providers?.includes("google") ?? false;
  const hasPassword = providers?.includes("credential") ?? false;
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">Cuenta</span>
      </div>
      <div className="flex flex-col gap-3 p-3.5 text-[13.5px]">
        {note && <Banner tone={note.tone}>{note.text}</Banner>}
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Email: <b>{session.user.email}</b>
          </span>
          <span className={`pill ${verified ? "pill-in" : "pill-warn"}`}>
            {verified ? "verificado" : "sin verificar"}
          </span>
          {!verified && mail && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await authClient.sendVerificationEmail({
                  email: session.user.email,
                  callbackURL: "/settings",
                });
                setBusy(false);
                setNote(
                  error
                    ? { tone: "out", text: "No se ha podido enviar el correo. Prueba más tarde." }
                    : { tone: "in", text: "Te hemos enviado un enlace para verificar el email." },
                );
                void refetch();
              }}
            >
              Enviar enlace de verificación
            </button>
          )}
        </div>
        {google && providers && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Google:</span>
            {hasGoogle ? (
              <span className="pill pill-in">vinculada · puedes entrar con Google</span>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const { error } = await authClient.linkSocial({
                    provider: "google",
                    callbackURL: "/settings",
                    errorCallbackURL: "/settings?linkError=1",
                  });
                  if (error) {
                    setBusy(false);
                    setNote({ tone: "out", text: "No se ha podido vincular Google." });
                  }
                }}
              >
                Vincular Google
              </button>
            )}
          </div>
        )}
        {hasPassword && <ChangePassword />}
        <OpenSessions />
      </div>
    </section>
  );
}

/** Qué avisos puedo silenciar (`NOTIFICATION_GROUPS`), con lo que ve el usuario. */
const GROUP_LABELS: Record<NotificationGroup, { label: string; hint: string }> = {
  follows: {
    label: "Gente que sigo",
    hint: "Mazos nuevos y cartas caras que añaden a su colección.",
  },
  prices: { label: "Bajadas de precio", hint: "De cartas que te faltan para tus mazos." },
  trades: { label: "Cruces de intercambio", hint: "Alguien tiene algo de tu lista de deseos." },
  proposals: {
    label: "Propuestas de intercambio",
    hint: "Te mandan una, la contraproponen, la aceptan…",
  },
  groups: {
    label: "Grupos y partidas",
    hint: "Alguien entra en tu grupo o te apunta a una partida.",
  },
  comments: { label: "Comentarios en tus mazos", hint: "" },
  loans: { label: "Préstamos", hint: "Alguien te presta una carta." },
};

/** /settings: nombre de usuario, privacidad de la colección, avisos de precio y salir. */
export function SettingsPage({ google, mail }: { google: boolean; mail: boolean }) {
  const [me, setMe] = useState<MyProfileDTO | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ tone: "in" | "out"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<MyProfileDTO>("/api/me/profile")
      .then((p) => {
        setMe(p);
        setUsername(p.username);
      })
      .catch((e: unknown) =>
        setMessage({ tone: "out", text: e instanceof ApiError ? e.message : "Error al cargar" }),
      );
  }, []);

  async function save(changes: {
    username?: string;
    collectionPublic?: boolean;
    tradesPublic?: boolean;
    priceAlertPercent?: number | null;
    mutedNotifications?: NotificationGroup[];
  }) {
    setBusy(true);
    setMessage(null);
    try {
      const p = await api<MyProfileDTO>("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      setMe(p);
      setUsername(p.username);
      setMessage({ tone: "in", text: "Guardado." });
    } catch (e) {
      setMessage({ tone: "out", text: e instanceof ApiError ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <main className="page">
        <h1 className="h1">Ajustes</h1>
        {message ? <Banner tone="out">{message.text}</Banner> : <Loading>Cargando…</Loading>}
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="h1">Ajustes</h1>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <AccountSection google={google} mail={mail} />

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Perfil público</span>
          <Link href={`/u/${me.username}`} style={{ fontSize: 13 }}>
            Ver mi perfil
          </Link>
        </div>
        <form
          className="flex flex-col gap-3 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ username });
          }}
        >
          <div className="field">
            <label className="label" htmlFor="username">
              Nombre de usuario
            </label>
            <div className="flex gap-2">
              <span
                className="input mono"
                style={{ width: "auto", display: "grid", placeItems: "center" }}
              >
                @
              </span>
              <input
                id="username"
                className="input mono"
                value={username}
                maxLength={20}
                autoComplete="off"
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: 34 }}
                disabled={busy || username === me.username}
              >
                Guardar
              </button>
            </div>
            <span className="hint">
              {USERNAME_HELP} Tu perfil: deckdoctor…/u/{username || "…"}
            </span>
          </div>
          <div className="kv">
            <span className="muted">Nombre</span>
            <span>{me.name}</span>
          </div>
          <div className="kv">
            <span className="muted">Email (no se enseña a nadie)</span>
            <span>{me.email}</span>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Privacidad</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <label className="check">
            <input
              type="checkbox"
              checked={me.collectionPublic}
              disabled={busy}
              onChange={(e) => void save({ collectionPublic: e.target.checked })}
            />
            <span>
              Colección pública
              <span className="subtle block text-xs">
                Cualquiera podrá verla en tu perfil, y quien te siga recibirá un aviso cuando añadas
                una carta de más de 20 €.
              </span>
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={me.tradesPublic}
              disabled={busy}
              onChange={(e) => void save({ tradesPublic: e.target.checked })}
            />
            <span>
              Listas de intercambio públicas
              <span className="subtle block text-xs">
                Tu lista de deseos y tus cartas para cambiar salen en tu perfil y en los cruces de{" "}
                <Link href="/trades">Intercambios</Link>.
              </span>
            </span>
          </label>
          <p className="subtle text-xs">
            Cada mazo tiene su propio interruptor público/privado en{" "}
            <Link href="/decks">Mis mazos</Link>.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Avisos</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <span className="hint">Los que desmarques no te llegarán ni a la web ni al móvil.</span>
          {NOTIFICATION_GROUP_KEYS.map((g) => (
            <label key={g} className="check">
              <input
                type="checkbox"
                checked={!me.mutedNotifications.includes(g)}
                disabled={busy}
                onChange={(e) => {
                  const mutedNotifications = e.target.checked
                    ? me.mutedNotifications.filter((x) => x !== g)
                    : [...me.mutedNotifications, g];
                  setMe({ ...me, mutedNotifications });
                  void save({ mutedNotifications });
                }}
              />
              <span>
                {GROUP_LABELS[g].label}
                {GROUP_LABELS[g].hint && (
                  <span className="subtle block text-xs">{GROUP_LABELS[g].hint}</span>
                )}
              </span>
            </label>
          ))}
          <div className="field">
            <label className="label" htmlFor="price-alert">
              Avisarme si algo que me falta baja de precio
            </label>
            <select
              id="price-alert"
              className="select"
              style={{ maxWidth: 260 }}
              disabled={busy}
              value={me.priceAlertPercent ?? "off"}
              onChange={(e) =>
                void save({
                  priceAlertPercent: e.target.value === "off" ? null : Number(e.target.value),
                })
              }
            >
              <option value="off">No avisarme</option>
              {[10, 15, 20, 25, 30, 40, 50].map((p) => (
                <option key={p} value={p}>
                  Si baja un {p} % o más
                </option>
              ))}
            </select>
            <span className="hint">
              Cada noche se miran las cartas que te faltan para tus mazos guardados y se comparan
              con su precio más alto de los 30 días anteriores. Como mucho, un aviso por carta a la
              semana.
            </span>
          </div>
        </div>
      </section>

      <BlockedUsers />

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Tus datos</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn" href="/api/me/export" download>
              Descargar todos mis datos (JSON)
            </a>
            <a className="btn" href="/api/collection/export" download>
              Exportar mi colección (CSV)
            </a>
          </div>
          <p className="subtle text-xs">
            Tu perfil, colección, mazos, listas de intercambio, propuestas, correcciones de roles,
            grupos, partidas, préstamos y comentarios. Más detalles en la{" "}
            <Link href="/privacy">política de privacidad</Link>.
          </p>
          <div className="dangerzone">
            <div>
              <b>Borrar mi cuenta</b>
              <span className="subtle block text-xs">
                Se borran para siempre tu colección, tus mazos, tus listas y tus propuestas. No se
                puede deshacer.
              </span>
            </div>
            <button type="button" className="btn btn-out" onClick={() => setDeleting(true)}>
              Borrar mi cuenta
            </button>
          </div>
        </div>
      </section>
      <DeleteAccountDialog open={deleting} email={me.email} onClose={() => setDeleting(false)} />

      <button
        type="button"
        className="btn btn-out self-start"
        onClick={async () => {
          await authClient.signOut();
          storage.remove("deck-doctor:mazo");
          clearCached();
          window.location.assign(new URL("/", window.location.origin));
        }}
      >
        <IconLogout size={14} />
        Salir
      </button>
    </main>
  );
}

/** La gente que he bloqueado, para desbloquearla. */
function BlockedUsers() {
  const [list, setList] = useState<(MemberDTO & { blockedAt: string })[] | null>(null);
  const load = () =>
    void api<(MemberDTO & { blockedAt: string })[]>("/api/me/blocks", undefined, { silent: true })
      .then(setList)
      .catch(() => setList([]));
  useEffect(load, []);
  if (!list || list.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">Bloqueados</span>
      </div>
      <ul className="memberlist">
        {list.map((m) => (
          <li key={m.username ?? m.name}>
            <span className="flex-1">
              {m.username ? <Link href={`/u/${m.username}`}>@{m.username}</Link> : m.name}
            </span>
            {m.username && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  void api(`/api/users/${m.username}/block`, { method: "DELETE" }).then(load)
                }
              >
                Desbloquear
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
