"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeedDTO, FeedItemDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { Avatar } from "./games-ui";
import { IconDecks, IconHeart, IconSwap, IconUsers } from "./icons";
import { ago, Banner, EmptyState, TilesSkeleton } from "./ui";

const FILTERS: [string, string][] = [
  ["", "Todo"],
  ["deck", "Mazos"],
  ["game", "Partidas"],
  ["comment", "Comentarios"],
  ["like", "Me gusta"],
  ["trade", "Intercambios"],
];

const who = (i: FeedItemDTO) => (
  <Link href={`/u/${i.actor.username}`} className="font-semibold">
    {i.actor.name}
  </Link>
);

function FeedEntry({ item: i }: { item: FeedItemDTO }) {
  const deck = "deck" in i ? i.deck : null;
  return (
    <li className={`feeditem feed-${i.type}`}>
      <Avatar m={i.actor} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[13.5px]">
          {i.type === "deck" && <>{who(i)} ha publicado un mazo</>}
          {i.type === "like" && (
            <>
              A {who(i)} le gusta un mazo de{" "}
              <Link href={`/u/${i.owner.username}`}>@{i.owner.username}</Link>
            </>
          )}
          {i.type === "comment" && <>{who(i)} ha comentado</>}
          {i.type === "game" && (
            <>
              {who(i)} {i.game.won ? "ha ganado" : "ha jugado"} una partida de {i.game.players}
              {i.game.won && i.game.deckName ? ` con ${i.game.deckName}` : ""}
              {!i.game.won && i.game.winner ? ` (ganó ${i.game.winner})` : ""}
              {i.game.group && (
                <>
                  {" "}
                  en <Link href={`/groups/${i.game.group.id}`}>{i.game.group.name}</Link>
                </>
              )}
            </>
          )}
          {i.type === "trade" && (
            <>
              {who(i)} ha cerrado un intercambio de {i.cards} {i.cards === 1 ? "carta" : "cartas"}{" "}
              con <Link href={`/u/${i.partner.username}`}>@{i.partner.username}</Link>
            </>
          )}
          <span className="subtle"> · {ago(i.at)}</span>
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
            Ver la partida
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
        setError(e instanceof ApiError ? e.message : "No se pudo cargar la actividad");
      } finally {
        setBusy(false);
      }
    },
    [type, compact],
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
          {FILTERS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              className={`chipbtn ${type === t ? "is-on" : ""}`}
              aria-pressed={type === t}
              onClick={() => setType(t)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <Banner tone="out">{error}</Banner>}
      {!items && !error && <TilesSkeleton count={5} columns={1} label="Cargando la actividad…" />}
      {items && items.length === 0 && (
        <div className="panel">
          <EmptyState
            title={following === 0 ? "Aún no sigues a nadie" : "Nada nuevo por aquí"}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className="btn btn-primary" href="/community">
                  <IconUsers size={14} /> Buscar gente
                </Link>
                <Link className="btn" href="/groups">
                  Crear un grupo
                </Link>
              </div>
            }
          >
            Aquí verás los mazos que publican, sus partidas, comentarios e intercambios.
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
          Ver toda la actividad
        </Link>
      )}
      {!compact && next && (
        <button
          type="button"
          className="btn self-center"
          disabled={busy}
          onClick={() => void load(next)}
        >
          {busy ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </div>
  );
}

export function FeedPage() {
  return (
    <main className="page">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Comunidad</span>
        <h1 className="h1">Actividad</h1>
        <p className="muted text-[13px]">Lo último de la gente que sigues y de tus grupos.</p>
      </div>
      <ActivityFeed />
    </main>
  );
}
