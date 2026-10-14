"use client";

import { useEffect, useState } from "react";
import { authClient, authErrorMessage } from "./auth-client";
import { formatDate } from "./collection-import";
import { Banner } from "./ui";

type Note = { tone: "in" | "out"; text: string } | null;

/** Cambiar la contraseña con sesión (solo si la cuenta tiene contraseña; con Google no). */
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
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
          setNote({ tone: "out", text: authErrorMessage(error) });
          return;
        }
        setCurrent("");
        setNext("");
        setNote({
          tone: "in",
          text: "Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.",
        });
      }}
    >
      <b>Cambiar la contraseña</b>
      {note && <Banner tone={note.tone}>{note.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="field" style={{ minWidth: 0, flex: "1 1 180px" }}>
          <span className="label">Contraseña actual</span>
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
          <span className="label">Nueva (mínimo 8 caracteres)</span>
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
          {show ? "Ocultar" : "Ver"}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || current === "" || next.length < 8}
        >
          Cambiar
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

/** "Chrome en Android", "Safari en iPhone", "App de Android"… a partir del User-Agent. */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Dispositivo desconocido";
  if (/okhttp|expo|doctordeck/i.test(ua)) return "App de Android";
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad/i.test(ua)
      ? "iPhone"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os/i.test(ua)
          ? "Mac"
          : /linux/i.test(ua)
            ? "Linux"
            : null;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /firefox|fxios/i.test(ua)
      ? "Firefox"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "Navegador";
  return os ? `${browser} en ${os}` : browser;
}

/** Sesiones abiertas: dónde tengo la cuenta abierta, con cerrar una o todas las demás. */
export function OpenSessions() {
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
        <b>Sesiones abiertas</b>
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
            Cerrar las demás ({others.length})
          </button>
        )}
      </div>
      <ul className="memberlist">
        {sorted.map((s) => (
          <li key={s.token}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span>
                {deviceLabel(s.userAgent)}
                {s.token === mine && <span className="pill pill-in ml-2">este dispositivo</span>}
              </span>
              <span className="subtle text-xs">
                Última vez: {formatDate(new Date(s.updatedAt).toISOString())}
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
                Cerrar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
