"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedDTO, FeedItemDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { Avatar } from "./games-ui";
import { IconDecks, IconHeart, IconSwap, IconUsers } from "./icons";
import { ago, Banner, EmptyState, TilesSkeleton } from "./ui";
import { Link, useLocale, useT, type T } from "@/components/i18n";

const filters = (t: T): [string, string][] => [
  ["", t("Todo", "All")],
  ["deck", t("Mazos", "Decks")],
  ["game", t("Partidas", "Games")],
  ["comment", t("Comentarios", "Comments")],
  ["like", t("Me gusta", "Likes")],
  ["trade", t("Intercambios", "Trades")],
];

const who = (i: FeedItemDTO) => (
  <Link href={`/u/${i.actor.username}`} className="font-semibold">
    {i.actor.name}
  </Link>
);

function FeedEntry({ item: i }: { item: FeedItemDTO }) {
  const t = useT();
  const locale = useLocale();
  const deck = "deck" in i ? i.deck : null;
  return (
    <li className={`feeditem feed-${i.type}`}>
      <Avatar m={i.actor} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[13.5px]">
          {i.type === "deck" && (
            <>
              {who(i)} {t("ha publicado un mazo", "published a deck")}
            </>
          )}
          {i.type === "like" && (
            <>
              {locale === "en" ? (
                <>{who(i)} liked a deck by </>
              ) : (
                <>A {who(i)} le gusta un mazo de </>
              )}
              <Link href={`/u/${i.owner.username}`}>@{i.owner.username}</Link>
            </>
          )}
          {i.type === "comment" && (
            <>
              {who(i)} {t("ha comentado", "commented")}
            </>
          )}
          {i.type === "game" && (
            <>
              {who(i)}{" "}
              {i.game.won
                ? t(
                    `ha ganado una partida de ${i.game.players}`,
                    `won a ${i.game.players}-player game`,
                  )
                : t(
                    `ha jugado una partida de ${i.game.players}`,
                    `played a ${i.game.players}-player game`,
                  )}
              {i.game.won && i.game.deckName ? ` ${t("con", "with")} ${i.game.deckName}` : ""}
              {!i.game.won && i.game.winner ? ` (${t("ganó", "won by")} ${i.game.winner})` : ""}
              {i.game.group && (
                <>
                  {" "}
                  {t("en", "in")}{" "}
                  <Link href={`/groups/${i.game.group.id}`}>{i.game.group.name}</Link>
                </>
              )}
            </>
          )}
          {i.type === "trade" && (
            <>
              {who(i)}{" "}
              {t(
                `ha cerrado un intercambio de ${i.cards} ${i.cards === 1 ? "carta" : "cartas"} con`,
                `closed a trade of ${i.cards} ${i.cards === 1 ? "card" : "cards"} with`,
              )}{" "}
              <Link href={`/u/${i.partner.username}`}>@{i.partner.username}</Link>
            </>
          )}
          <span className="subtle"> · {ago(i.at, locale)}</span>
        </p>
        {deck && (
          <Link
            href={`/decks/${deck.id}${i.type === "comment" ? "#comments" : ""}`}
            className="feeddeck"
          >
            <div className="w-[52px] flex-none">
              {deck.commanderCard ? (
                <CardImage card={deck.commanderCard} sizes="52px" />
              ) : (
                <span className="cardimg-missing" />
              )}
            </div>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate">{deck.name}</b>
              <span className="subtle truncate text-xs">{deck.commanders.join(" + ")}</span>
              {i.type === "comment" && <span className="feedquote">“{i.excerpt}”</span>}
            </span>
          </Link>
        )}
        {i.type === "game" && (
          <Link href={`/games/${i.game.id}`} className="text-xs">
            {t("Ver la partida", "See the game")}
          </Link>
        )}
      </div>
      <span className="feedicon" aria-hidden="true">
        {i.type === "deck" || i.type === "comment" ? (
          <IconDecks size={14} />
        ) : i.type === "like" ? (
          <IconHeart size={14} filled />
        ) : i.type === "trade" ? (
          <IconSwap size={14} />
        ) : (
          <span style={{ fontSize: 14 }}>♛</span>
        )}
      </span>
    </li>
  );
}

/** Feed de actividad de la gente que sigo y de mis grupos. `compact`: para la portada. */
export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const FILTERS = filters(t);
  const [type, setType] = useState("");
  const [items, setItems] = useState<FeedItemDTO[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [following, setFollowing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (before: string | null) => {
      setBusy(true);
      try {
        const q = new URLSearchParams();
        if (type) q.set("types", type);
        if (before) q.set("before", before);
        const d = await api<FeedDTO>(`/api/feed?${q}`, undefined, { silent: compact });
        setItems((x) => (before ? [...(x ?? []), ...d.items] : d.items));
        setNext(d.next);
        setFollowing(d.following);
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.message
            : t("No se pudo cargar la actividad", "Couldn't load the activity"),
        );
      } finally {
        setBusy(false);
      }
    },
    [type, compact, t],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar o cambiar el filtro
    void load(null);
  }, [load]);

  const shown = compact ? (items ?? []).slice(0, 6) : (items ?? []);
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="chips">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`chipbtn ${type === k ? "is-on" : ""}`}
              aria-pressed={type === k}
              onClick={() => setType(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <Banner tone="out">{error}</Banner>}
      {!items && !error && (
        <TilesSkeleton
          count={5}
          columns={1}
          label={t("Cargando la actividad…", "Loading the activity…")}
        />
      )}
      {items && items.length === 0 && (
        <div className="panel">
          <EmptyState
            title={
              following === 0
                ? t("Aún no sigues a nadie", "You don't follow anyone yet")
                : t("Nada nuevo por aquí", "Nothing new here")
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className={compact ? "btn" : "btn btn-primary"} href="/community">
                  <IconUsers size={14} /> {t("Buscar gente", "Find people")}
                </Link>
                <Link className="btn" href="/groups">
                  {t("Crear un grupo", "Create a group")}
                </Link>
              </div>
            }
          >
            {t(
              "Aquí verás los mazos que publican, sus partidas, comentarios e intercambios.",
              "Here you'll see the decks they publish, their games, comments and trades.",
            )}
          </EmptyState>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="panel feed">
          {shown.map((i) => (
            <FeedEntry key={i.id} item={i} />
          ))}
        </ul>
      )}
      {compact && items && items.length > 6 && (
        <Link className="btn btn-ghost self-start" href="/feed">
          {t("Ver toda la actividad", "See all activity")}
        </Link>
      )}
      {!compact && next && (
        <button
          type="button"
          className="btn self-center"
          disabled={busy}
          onClick={() => void load(next)}
        >
          {busy ? t("Cargando…", "Loading…") : t("Cargar más", "Load more")}
        </button>
      )}
    </div>
  );
}

export function FeedPage() {
  const t = useT();
  return (
    <main className="page">
      <div className="flex flex-col gap-1">
        <h1 className="h1">{t("Actividad", "Activity")}</h1>
        <p className="muted text-[13px]">
          {t(
            "Lo último de la gente que sigues y de tus grupos.",
            "The latest from people you follow and your groups.",
          )}
        </p>
      </div>
      <ActivityFeed />
    </main>
  );
}
