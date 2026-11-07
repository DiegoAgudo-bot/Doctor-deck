"use client";

import { useEffect, useState } from "react";
import { deviceLabel } from "@/domain/social/device-label";
import { authClient, authErrorMessage } from "./auth-client";
import { formatDate } from "./collection-import";
import { Banner } from "./ui";
import { useIntlLocale, useLocale, useT } from "./i18n";

type Note = { tone: "in" | "out"; text: string } | null;

/** Cambiar la contraseña con sesión (solo si la cuenta tiene contraseña; con Google no). */
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const locale = useLocale();
  const [note, setNote] = useState<Note>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const { error } = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        setBusy(false);
        if (error) {
          setNote({ tone: "out", text: authErrorMessage(error, locale) });
          return;
        }
        setCurrent("");
        setNext("");
        setNote({
          tone: "in",
          text: t(
            "Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.",
            "Password changed. Your sessions on other devices have been signed out.",
          ),
        });
      }}
    >
      <b>{t("Cambiar la contraseña", "Change password")}</b>
      {note && <Banner tone={note.tone}>{note.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="field" style={{ minWidth: 0, flex: "1 1 180px" }}>
          <span className="label">{t("Contraseña actual", "Current password")}</span>
          <input
            className="input"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="field" style={{ minWidth: 0, flex: "1 1 180px" }}>
          <span className="label">
            {t("Nueva (mínimo 8 caracteres)", "New (at least 8 characters)")}
          </span>
          <input
            className="input"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </label>
        <button type="button" className="btn btn-ghost" onClick={() => setShow((v) => !v)}>
          {show ? t("Ocultar", "Hide") : t("Ver", "Show")}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || current === "" || next.length < 8}
        >
          {t("Cambiar", "Change")}
        </button>
      </div>
    </form>
  );
}

interface SessionRow {
  token: string;
  userAgent?: string | null | undefined;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Sesiones abiertas: dónde tengo la cuenta abierta, con cerrar una o todas las demás. */
export function OpenSessions() {
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const { data: current } = authClient.useSession();
  const [list, setList] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    void authClient.listSessions().then(({ data }) => setList((data ?? []) as SessionRow[]));
  useEffect(load, []);

  if (!list || !current) return null;
  const mine = current.session.token;
  const others = list.filter((s) => s.token !== mine);
  const sorted = [
    ...list.filter((s) => s.token === mine),
    ...others.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{t("Sesiones abiertas", "Open sessions")}</b>
        {others.length > 0 && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await authClient.revokeOtherSessions();
              setBusy(false);
              load();
            }}
          >
            {t("Cerrar las demás", "Sign out the others")} ({others.length})
          </button>
        )}
      </div>
      <ul className="memberlist">
        {sorted.map((s) => (
          <li key={s.token}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span>
                {deviceLabel(s.userAgent, locale)}
                {s.token === mine && (
                  <span className="pill pill-in ml-2">{t("este dispositivo", "this device")}</span>
                )}
              </span>
              <span className="subtle text-xs">
                {t("Última vez", "Last seen")}:{" "}
                {formatDate(new Date(s.updatedAt).toISOString(), intl)}
              </span>
            </span>
            {s.token !== mine && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await authClient.revokeSession({ token: s.token });
                  setBusy(false);
                  load();
                }}
              >
                {t("Cerrar", "Sign out")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
