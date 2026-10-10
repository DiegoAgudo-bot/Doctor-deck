"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProfileViewDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CollectionBrowser } from "./collection-browser";
import { DeckTile } from "./deck-tile";
import { nextVisibility, setDeckVisibility } from "./deck-visibility";
import { IconEyeOff, IconSettings } from "./icons";
import { Banner, EmptyState, Loading, fmt } from "./ui";

/** /u/{username}: perfil público con sus mazos y, si la tiene pública, su colección. */
export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [view, setView] = useState<ProfileViewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mazos" | "coleccion">("mazos");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ProfileViewDTO>(`/api/users/${encodeURIComponent(username)}`, undefined, { silent: true })
      .then(setView)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "No se pudo cargar el perfil"),
      );
  }, [username, session]);

  async function toggleFollow() {
    if (!view) return;
    if (!session) {
      router.push(`/entrar?next=${encodeURIComponent(`/u/${username}`)}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ isFollowing: boolean; followers: number }>(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: view.isFollowing ? "DELETE" : "POST" },
      );
      setView({ ...view, isFollowing: r.isFollowing, followers: r.followers });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="page max-w-[1100px]">
        <Banner tone="out">{error}</Banner>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="page max-w-[1100px]">
        <Loading>Cargando el perfil…</Loading>
      </main>
    );
  }

  const { profile } = view;
  const canSeeCollection = profile.collectionPublic || view.isMe;
  const publicCount = view.decks.filter((d) => d.visibility === "public").length;
  return (
    <main className="page max-w-[1100px]">
      <section className="stack-sm flex items-center gap-4">
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 26 }} aria-hidden="true">
          {(profile.name.trim()[0] ?? profile.username[0] ?? "?").toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="h1">{profile.name}</h1>
          <span className="muted">@{profile.username}</span>
          <span className="subtle flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <span>
              <b className="mono" style={{ color: "var(--color-text)" }}>
                {fmt(view.followers)}
              </b>{" "}
              {view.followers === 1 ? "seguidor" : "seguidores"}
            </span>
            <span>
              <b className="mono" style={{ color: "var(--color-text)" }}>
                {fmt(view.following)}
              </b>{" "}
              siguiendo
            </span>
            <span>
              <b className="mono" style={{ color: "var(--color-text)" }}>
                {fmt(publicCount)}
              </b>{" "}
              {publicCount === 1 ? "mazo público" : "mazos públicos"}
            </span>
          </span>
        </div>
        {view.isMe ? (
          <Link className="btn" href="/ajustes">
            <IconSettings size={14} />
            Editar perfil
          </Link>
        ) : (
          <button
            type="button"
            className={`btn ${view.isFollowing ? "" : "btn-primary"}`}
            disabled={busy}
            onClick={() => void toggleFollow()}
          >
            {view.isFollowing ? "Siguiendo" : "Seguir"}
          </button>
        )}
      </section>

      <nav className="tabs" aria-label="Secciones del perfil">
        <button
          type="button"
          className={tab === "mazos" ? "is-active" : ""}
          onClick={() => setTab("mazos")}
        >
          Mazos <span className="n">{view.decks.length}</span>
        </button>
        <button
          type="button"
          className={tab === "coleccion" ? "is-active" : ""}
          onClick={() => setTab("coleccion")}
        >
          Colección
          {!profile.collectionPublic && <IconEyeOff size={12} aria-label="privada" />}
        </button>
      </nav>

      {tab === "mazos" &&
        (view.decks.length === 0 ? (
          <div className="panel">
            <EmptyState
              title={
                view.isMe ? "Aún no has guardado ningún mazo" : "Todavía no tiene mazos públicos"
              }
              action={
                view.isMe ? (
                  <Link className="btn btn-primary" href="/mazo?nuevo=1">
                    Analizar mazo
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div
            className="grid-1-sm grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {view.decks.map((d, i) => (
              <DeckTile
                key={d.id}
                deck={d}
                delay={i * 40}
                onToggleVisibility={
                  view.isMe
                    ? () =>
                        void setDeckVisibility(api, d.id, nextVisibility(d.visibility)).then(
                          ({ visibility }) =>
                            setView({
                              ...view,
                              decks: view.decks.map((x) =>
                                x.id === d.id ? { ...x, visibility } : x,
                              ),
                            }),
                        )
                    : undefined
                }
              />
            ))}
          </div>
        ))}

      {tab === "coleccion" &&
        (canSeeCollection ? (
          <>
            {view.isMe && !profile.collectionPublic && (
              <Banner
                tone="info"
                action={
                  <Link className="btn btn-sm" href="/ajustes">
                    Hacerla pública
                  </Link>
                }
              >
                Tu colección es privada: solo la ves tú.
              </Banner>
            )}
            <CollectionBrowser
              loggedIn={true}
              localPairs={null}
              version={0}
              username={profile.username}
            />
          </>
        ) : (
          <div className="panel">
            <EmptyState title="Su colección es privada">
              {profile.name} ha decidido no enseñar su colección.
            </EmptyState>
          </div>
        ))}
    </main>
  );
}
