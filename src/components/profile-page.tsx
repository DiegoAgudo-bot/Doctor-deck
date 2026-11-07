"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  CommunityDeckDTO,
  CommunityResponse,
  ProfileViewDTO,
  TradePartnerDTO,
} from "@/server/dto";
import { api, ApiError } from "./api-client";
import { authClient } from "./auth-client";
import { CollectionBrowser } from "./collection-browser";
import { DeckTile } from "./deck-tile";
import { localCollection, ownedPairs } from "./local-collection";
import { PartnerCard } from "./trades-page";
import { IconEyeOff, IconSettings } from "./icons";
import { Banner, Dialog, EmptyState, Loading, useFormat } from "./ui";
import { Link, useRouter, useT } from "@/components/i18n";

/** /u/{username}: perfil público con sus mazos y, si la tiene pública, su colección. */
export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const t = useT();
  const { fmt } = useFormat();
  const [view, setView] = useState<ProfileViewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mazos" | "coleccion">("mazos");
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  /** En el perfil de otro: cuánto tengo de cada uno de sus mazos públicos, "me gusta" y bracket. */
  const [extra, setExtra] = useState<Map<string, CommunityDeckDTO>>(new Map());

  useEffect(() => {
    api<ProfileViewDTO>(`/api/users/${encodeURIComponent(username)}`, undefined, { silent: true })
      .then(setView)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError
            ? e.message
            : t("No se pudo cargar el perfil", "Couldn't load the profile"),
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` no cambia en la página
  }, [username, session]);

  const isMe = view?.isMe ?? true;
  /** Cruce de intercambio con este jugador (si tiene listas públicas y he entrado). */
  const [trade, setTrade] = useState<TradePartnerDTO[] | null>(null);
  const tradesPublic = view?.profile.tradesPublic ?? false;
  useEffect(() => {
    if (isMe || !tradesPublic || !session) return;
    api<TradePartnerDTO[]>(
      `/api/trades/matches?username=${encodeURIComponent(username)}`,
      undefined,
      { silent: true },
    )
      .then(setTrade)
      .catch(() => setTrade(null));
  }, [isMe, tradesPublic, session, username]);
  useEffect(() => {
    if (isMe) return;
    const local = session ? null : localCollection.get();
    api<CommunityResponse>(
      "/api/community/decks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { username },
          limit: 100,
          ...(local ? { collection: ownedPairs(local) } : {}),
        }),
      },
      { silent: true },
    )
      .then((r) => setExtra(new Map(r.items.map((d) => [d.id, d]))))
      .catch(() => setExtra(new Map()));
  }, [isMe, username, session]);

  async function toggleFollow() {
    if (!view) return;
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
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
      setError(
        e instanceof ApiError ? e.message : t("No se pudo completar", "Couldn't complete it"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!view) return;
    setBusy(true);
    try {
      await api(`/api/users/${encodeURIComponent(username)}/block`, {
        method: view.blocked ? "DELETE" : "POST",
      });
      setView({
        ...view,
        blocked: !view.blocked,
        isFollowing: view.blocked ? view.isFollowing : false,
      });
      setConfirmBlock(false);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : t("No se pudo completar", "Couldn't complete it"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="page">
        <Banner tone="out">{error}</Banner>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="page">
        <Loading>{t("Cargando el perfil…", "Loading the profile…")}</Loading>
      </main>
    );
  }

  const { profile } = view;
  const canSeeCollection = profile.collectionPublic || view.isMe;
  const publicCount = view.decks.filter((d) => d.visibility === "public").length;
  return (
    <main className="page">
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
              {view.followers === 1 ? t("seguidor", "follower") : t("seguidores", "followers")}
            </span>
            <span>
              <b className="mono" style={{ color: "var(--color-text)" }}>
                {fmt(view.following)}
              </b>{" "}
              {t("siguiendo", "following")}
            </span>
            <span>
              <b className="mono" style={{ color: "var(--color-text)" }}>
                {fmt(publicCount)}
              </b>{" "}
              {publicCount === 1
                ? t("mazo público", "public deck")
                : t("mazos públicos", "public decks")}
            </span>
            {view.record.games > 0 && (
              <span title={t("Partidas registradas", "Recorded games")}>
                ♛{" "}
                <b className="mono" style={{ color: "var(--color-text)" }}>
                  {fmt(view.record.wins)}/{fmt(view.record.games)}
                </b>{" "}
                {t(view.record.games === 1 ? "partida ganada" : "partidas ganadas", "games won")}
              </span>
            )}
          </span>
        </div>
        {view.isMe ? (
          <Link className="btn" href="/settings">
            <IconSettings size={14} />
            {t("Editar perfil", "Edit profile")}
          </Link>
        ) : (
          <div className="flex gap-2">
            {!view.blocked && (
              <button
                type="button"
                className={`btn ${view.isFollowing ? "" : "btn-primary"}`}
                disabled={busy}
                onClick={() => void toggleFollow()}
              >
                {view.isFollowing ? t("Siguiendo", "Following") : t("Seguir", "Follow")}
              </button>
            )}
            {session && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => (view.blocked ? void toggleBlock() : setConfirmBlock(true))}
              >
                {view.blocked ? t("Desbloquear", "Unblock") : t("Bloquear", "Block")}
              </button>
            )}
          </div>
        )}
      </section>

      {view.blocked && (
        <Banner tone="warn">
          {t(
            `Has bloqueado a @${profile.username}: no puede seguirte, comentar tus mazos ni proponerte intercambios, y no ves su actividad.`,
            `You've blocked @${profile.username}: they can't follow you, comment on your decks or offer you trades, and you don't see their activity.`,
          )}
        </Banner>
      )}
      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={t(`Bloquear a @${profile.username}`, `Block @${profile.username}`)}
        width={420}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmBlock(false)}>
              {t("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-out"
              disabled={busy}
              onClick={() => void toggleBlock()}
            >
              {t("Bloquear", "Block")}
            </button>
          </>
        }
      >
        <p className="text-[13.5px]">
          {t(
            "Dejaréis de seguiros, no podrá comentar tus mazos ni proponerte intercambios ni préstamos, y no verás sus comentarios ni su actividad. No se le avisa. Puedes desbloquearle cuando quieras desde aquí o desde Ajustes.",
            "You'll stop following each other, they won't be able to comment on your decks or offer you trades or loans, and you won't see their comments or activity. They aren't notified. You can unblock them whenever you want, here or from Settings.",
          )}
        </p>
      </Dialog>

      <nav className="tabs" aria-label={t("Secciones del perfil", "Profile sections")}>
        <button
          type="button"
          className={tab === "mazos" ? "is-active" : ""}
          onClick={() => setTab("mazos")}
        >
          {t("Mazos", "Decks")} <span className="n">{view.decks.length}</span>
        </button>
        <button
          type="button"
          className={tab === "coleccion" ? "is-active" : ""}
          onClick={() => setTab("coleccion")}
        >
          {t("Colección", "Collection")}
          {!profile.collectionPublic && (
            <IconEyeOff size={12} aria-label={t("privada", "private")} />
          )}
        </button>
      </nav>

      {tab === "mazos" &&
        (view.decks.length === 0 ? (
          <div className="panel">
            <EmptyState
              title={
                view.isMe
                  ? t("Aún no has guardado ningún mazo", "You haven't saved any decks yet")
                  : t("Todavía no tiene mazos públicos", "No public decks yet")
              }
              action={
                view.isMe ? (
                  <Link className="btn btn-primary" href="/decks/new">
                    {t("Nuevo mazo", "New deck")}
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
                ownership={extra.get(d.id)?.ownership}
                likes={extra.get(d.id)?.likes}
                bracket={extra.get(d.id)?.bracket}
              />
            ))}
          </div>
        ))}

      {tab === "mazos" && trade && (
        <section className="flex flex-col gap-2">
          <h2 className="h2" style={{ fontSize: 17 }}>
            {t("Intercambio con", "Trade with")} @{profile.username}
          </h2>
          {trade.length > 0 ? (
            <PartnerCard p={trade[0]!} />
          ) : (
            <p className="muted text-[13px]">
              {t(
                "No tiene libre nada de tu lista de deseos ni busca nada de lo que te sobra.",
                "They don't have anything free from your wishlist and aren't looking for anything you have spare.",
              )}{" "}
              <Link href="/trades">{t("Tus listas", "Your lists")}</Link> ·{" "}
              <Link href={`/trades/with/${profile.username}`}>
                {t("Proponer un intercambio a mano", "Propose a trade by hand")}
              </Link>
            </p>
          )}
        </section>
      )}

      {tab === "coleccion" &&
        (canSeeCollection ? (
          <>
            {view.isMe && !profile.collectionPublic && (
              <Banner
                tone="info"
                action={
                  <Link className="btn btn-sm" href="/settings">
                    {t("Hacerla pública", "Make it public")}
                  </Link>
                }
              >
                {t(
                  "Tu colección es privada: solo la ves tú.",
                  "Your collection is private: only you can see it.",
                )}
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
            <EmptyState title={t("Su colección es privada", "Their collection is private")}>
              {t(
                `${profile.name} ha decidido no enseñar su colección.`,
                `${profile.name} has chosen not to show their collection.`,
              )}
            </EmptyState>
          </div>
        ))}
    </main>
  );
}
