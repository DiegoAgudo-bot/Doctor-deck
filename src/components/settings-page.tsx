"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChangePassword, OpenSessions } from "./account-security";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  NOTIFICATION_GROUP_KEYS,
  notificationGroupLabel,
  type NotificationGroup,
} from "@/domain/social/notification-prefs";
import { USERNAME_HELP, USERNAME_HELP_EN } from "@/domain/social/username";
import type { MyProfileDTO } from "@/server/dto";
import type { MemberDTO } from "@/server/social-dto";
import { clearCached } from "./swr-cache";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { IconLogout } from "./icons";
import { Banner, Loading } from "./ui";
import { Link, goTo, useLocale, useLocalePath, useT } from "@/components/i18n";

/**
 * Cuenta: email verificado o no (con reenvío del enlace) y cuentas vinculadas (Google). Vincular
 * con sesión es la forma segura de unir Google a una cuenta creada con contraseña.
 */
function AccountSection({ google, mail }: { google: boolean; mail: boolean }) {
  const t = useT();
  const lp = useLocalePath();
  const { data: session, refetch } = authClient.useSession();
  const [providers, setProviders] = useState<string[] | null>(null);
  const linkError = useSearchParams().get("linkError");
  const [note, setNote] = useState<{ tone: "in" | "out"; text: string } | null>(
    linkError
      ? {
          tone: "out",
          text: t(
            "No se ha podido vincular Google. Comprueba que usas la cuenta de Google con el mismo email (o que no está ya vinculada a otro usuario).",
            "Couldn't link Google. Check you're using the Google account with the same email (and that it isn't already linked to another user).",
          ),
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
        <span className="h2">{t("Cuenta", "Account")}</span>
      </div>
      <div className="flex flex-col gap-3 p-3.5 text-[13.5px]">
        {note && <Banner tone={note.tone}>{note.text}</Banner>}
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Email: <b>{session.user.email}</b>
          </span>
          <span className={`pill ${verified ? "pill-in" : "pill-warn"}`}>
            {verified ? t("verificado", "verified") : t("sin verificar", "not verified")}
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
                  callbackURL: lp("/settings"),
                });
                setBusy(false);
                setNote(
                  error
                    ? {
                        tone: "out",
                        text: t(
                          "No se ha podido enviar el correo. Prueba más tarde.",
                          "Couldn't send the email. Try again later.",
                        ),
                      }
                    : {
                        tone: "in",
                        text: t(
                          "Te hemos enviado un enlace para verificar el email.",
                          "We've sent you a link to verify your email.",
                        ),
                      },
                );
                void refetch();
              }}
            >
              {t("Enviar enlace de verificación", "Send verification link")}
            </button>
          )}
        </div>
        {google && providers && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Google:</span>
            {hasGoogle ? (
              <span className="pill pill-in">
                {t("vinculada · puedes entrar con Google", "linked · you can sign in with Google")}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const { error } = await authClient.linkSocial({
                    provider: "google",
                    callbackURL: lp("/settings"),
                    errorCallbackURL: lp("/settings?linkError=1"),
                  });
                  if (error) {
                    setBusy(false);
                    setNote({
                      tone: "out",
                      text: t("No se ha podido vincular Google.", "Couldn't link Google."),
                    });
                  }
                }}
              >
                {t("Vincular Google", "Link Google")}
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

/** /settings: nombre de usuario, privacidad de la colección, avisos de precio y salir. */
export function SettingsPage({ google, mail }: { google: boolean; mail: boolean }) {
  const t = useT();
  const locale = useLocale();
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
        setMessage({
          tone: "out",
          text: e instanceof ApiError ? e.message : t("Error al cargar", "Couldn't load"),
        }),
      );
  }, [t]);

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
      setMessage({ tone: "in", text: t("Guardado.", "Saved.") });
    } catch (e) {
      setMessage({
        tone: "out",
        text: e instanceof ApiError ? e.message : t("No se pudo guardar", "Couldn't save"),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <main className="page">
        <h1 className="h1">{t("Ajustes", "Settings")}</h1>
        {message ? (
          <Banner tone="out">{message.text}</Banner>
        ) : (
          <Loading>{t("Cargando…", "Loading…")}</Loading>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="h1">{t("Ajustes", "Settings")}</h1>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <AccountSection google={google} mail={mail} />

      <section className="panel">
        <div className="panel-h">
          <span className="h2">{t("Perfil público", "Public profile")}</span>
          <Link href={`/u/${me.username}`} style={{ fontSize: 13 }}>
            {t("Ver mi perfil", "View my profile")}
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
              {t("Nombre de usuario", "Username")}
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
                {t("Guardar", "Save")}
              </button>
            </div>
            <span className="hint">
              {locale === "en" ? USERNAME_HELP_EN : USERNAME_HELP} {t("Tu perfil", "Your profile")}:
              doctordeck.app/u/{username || "…"}
            </span>
          </div>
          <div className="kv">
            <span className="muted">{t("Nombre", "Name")}</span>
            <span>{me.name}</span>
          </div>
          <div className="kv">
            <span className="muted">
              {t("Email (no se enseña a nadie)", "Email (never shown to anyone)")}
            </span>
            <span>{me.email}</span>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">{t("Privacidad", "Privacy")}</span>
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
              {t("Colección pública", "Public collection")}
              <span className="subtle block text-xs">
                {t(
                  "Cualquiera podrá verla en tu perfil, y quien te siga recibirá un aviso cuando añadas una carta de más de 20 €.",
                  "Anyone can see it on your profile, and your followers get a notification when you add a card worth over €20.",
                )}
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
              {t("Listas de intercambio públicas", "Public trade lists")}
              <span className="subtle block text-xs">
                {t(
                  "Tu lista de deseos y tus cartas para cambiar salen en tu perfil y en los cruces de",
                  "Your wishlist and your cards for trade show on your profile and in the matches of",
                )}{" "}
                <Link href="/trades">{t("Intercambios", "Trades")}</Link>.
              </span>
            </span>
          </label>
          <p className="subtle text-xs">
            {t(
              "Cada mazo tiene su propio interruptor público/privado en",
              "Each deck has its own public/private switch in",
            )}{" "}
            <Link href="/decks">{t("Mis mazos", "My decks")}</Link>.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">{t("Avisos", "Notifications")}</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <span className="hint">
            {t(
              "Los que desmarques no te llegarán ni a la web ni al móvil.",
              "The ones you uncheck won't reach you on the web or on your phone.",
            )}
          </span>
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
                {notificationGroupLabel(g, locale).label}
                {notificationGroupLabel(g, locale).hint && (
                  <span className="subtle block text-xs">
                    {notificationGroupLabel(g, locale).hint}
                  </span>
                )}
              </span>
            </label>
          ))}
          <div className="field">
            <label className="label" htmlFor="price-alert">
              {t(
                "Avisarme si algo que me falta baja de precio",
                "Notify me if something I'm missing drops in price",
              )}
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
              <option value="off">{t("No avisarme", "Don't notify me")}</option>
              {[10, 15, 20, 25, 30, 40, 50].map((p) => (
                <option key={p} value={p}>
                  {t(`Si baja un ${p} % o más`, `If it drops ${p}% or more`)}
                </option>
              ))}
            </select>
            <span className="hint">
              {t(
                "Cada noche se miran las cartas que te faltan para tus mazos guardados y se comparan con su precio más alto de los 30 días anteriores. Como mucho, un aviso por carta a la semana.",
                "Every night the cards you're missing for your saved decks are compared with their highest price of the previous 30 days. At most one notification per card a week.",
              )}
            </span>
          </div>
        </div>
      </section>

      <BlockedUsers />

      <section className="panel">
        <div className="panel-h">
          <span className="h2">{t("Tus datos", "Your data")}</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn" href="/api/me/export" download>
              {t("Descargar todos mis datos (JSON)", "Download all my data (JSON)")}
            </a>
            <a className="btn" href="/api/collection/export" download>
              {t("Exportar mi colección (CSV)", "Export my collection (CSV)")}
            </a>
          </div>
          <p className="subtle text-xs">
            {t(
              "Tu perfil, colección, mazos, listas de intercambio, propuestas, correcciones de roles, grupos, partidas, préstamos y comentarios. Más detalles en la",
              "Your profile, collection, decks, trade lists, proposals, role corrections, groups, games, loans and comments. More details in the",
            )}{" "}
            <Link href="/privacy">{t("política de privacidad", "privacy policy")}</Link>.
          </p>
          <div className="dangerzone">
            <div>
              <b>{t("Borrar mi cuenta", "Delete my account")}</b>
              <span className="subtle block text-xs">
                {t(
                  "Se borran para siempre tu colección, tus mazos, tus listas y tus propuestas. No se puede deshacer.",
                  "Your collection, decks, lists and proposals are deleted forever. This can't be undone.",
                )}
              </span>
            </div>
            <button type="button" className="btn btn-out" onClick={() => setDeleting(true)}>
              {t("Borrar mi cuenta", "Delete my account")}
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
          goTo("/");
        }}
      >
        <IconLogout size={14} />
        {t("Salir", "Sign out")}
      </button>
    </main>
  );
}

/** La gente que he bloqueado, para desbloquearla. */
function BlockedUsers() {
  const t = useT();
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
        <span className="h2">{t("Bloqueados", "Blocked")}</span>
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
                {t("Desbloquear", "Unblock")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
