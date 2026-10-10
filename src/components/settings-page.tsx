"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { USERNAME_HELP } from "@/domain/social/username";
import type { MyProfileDTO } from "@/server/dto";
import { api, ApiError, storage } from "./api-client";
import { authClient } from "./auth-client";
import { IconLogout } from "./icons";
import { Banner, Loading } from "./ui";

/** /ajustes: nombre de usuario, privacidad de la colección, avisos de precio y salir. */
export function SettingsPage() {
  const [me, setMe] = useState<MyProfileDTO | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ tone: "in" | "out"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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
      <main className="page max-w-[640px]">
        <h1 className="h1">Ajustes</h1>
        {message ? <Banner tone="out">{message.text}</Banner> : <Loading>Cargando…</Loading>}
      </main>
    );
  }

  return (
    <main className="page max-w-[640px]">
      <h1 className="h1">Ajustes</h1>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

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
                <Link href="/intercambios">Intercambios</Link>.
              </span>
            </span>
          </label>
          <p className="subtle text-xs">
            Cada mazo tiene su propio interruptor público/privado en{" "}
            <Link href="/mazos">Mis mazos</Link>.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Avisos de precio</span>
        </div>
        <div className="flex flex-col gap-3 p-3.5">
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

      <button
        type="button"
        className="btn btn-out self-start"
        onClick={async () => {
          await authClient.signOut();
          storage.remove("deck-doctor:mazo");
          window.location.assign(new URL("/", window.location.origin));
        }}
      >
        <IconLogout size={14} />
        Salir
      </button>
    </main>
  );
}
