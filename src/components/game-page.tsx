"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameDTO } from "@/server/social-dto";
import { api, ApiError } from "./api-client";
import { Avatar, memberLabel, MemberLink, playedOn } from "./games-ui";
import { IconTrash } from "./icons";
import { Banner, Loading } from "./ui";
import { Link, useIntlLocale, useRouter, useT } from "@/components/i18n";

/** /games/{id}: una partida registrada. */
export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const intl = useIntlLocale();
  const [game, setGame] = useState<GameDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<GameDTO>(`/api/games/${id}`)
      .then(setGame)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : t("No se pudo cargar", "Couldn't load")),
      );
  }, [id, t]);

  if (!game) {
    return (
      <main className="page">
        {error ? (
          <Banner tone="out">{error}</Banner>
        ) : (
          <Loading>{t("Cargando la partida…", "Loading the game…")}</Loading>
        )}
      </main>
    );
  }

  const winner = game.players.find((p) => p.winner);
  const back = game.group ? `/groups/${game.group.id}` : "/groups";
  return (
    <main className="page">
      <Link className="subtle text-[13px]" href={back}>
        ← {game.group ? game.group.name : t("Grupos", "Groups")}
      </Link>
      <section className="gamehero">
        <span className="lifewin-crown">♛</span>
        <h1 className="h1">
          {winner
            ? `${t("Ganó", "Won by")} ${winner.user ? memberLabel(winner.user) : winner.guestName}`
            : t("Sin ganador", "No winner")}
        </h1>
        <span className="muted text-[13px]">
          {winner?.deckName ? `${t("con", "with")} ${winner.deckName} · ` : ""}
          {playedOn(game.playedAt, intl)}
          {game.turns
            ? ` · ${game.turns} ${game.turns === 1 ? t("turno", "turn") : t("turnos", "turns")}`
            : ""}
        </span>
      </section>
      {error && <Banner tone="out">{error}</Banner>}
      <ul className="panel memberlist">
        {game.players.map((p) => (
          <li key={p.seat} className={p.winner ? "is-winner" : ""}>
            {p.user ? (
              <Avatar m={p.user} size={34} />
            ) : (
              <Avatar m={{ name: p.guestName ?? "?" }} size={34} />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate">
                {p.user ? (
                  <MemberLink m={p.user} />
                ) : (
                  `${p.guestName} ${t("(invitado)", "(guest)")}`
                )}
              </b>
              <span className="subtle truncate text-xs">
                {p.deckId ? (
                  <Link href={`/decks/${p.deckId}`}>{p.deckName}</Link>
                ) : (
                  p.deckName || t("Mazo sin indicar", "Deck not given")
                )}
                {p.commanderNames.length > 0 && ` · ${p.commanderNames.join(" + ")}`}
              </span>
            </span>
            {p.winner && <span className="pill pill-warn">♛ {t("Ganador", "Winner")}</span>}
          </li>
        ))}
      </ul>
      {game.notes && <p className="panel p-3.5 text-[13.5px]">“{game.notes}”</p>}
      {game.canDelete && (
        <button
          type="button"
          className="btn btn-ghost self-start"
          onClick={() =>
            void api(`/api/games/${id}`, { method: "DELETE" })
              .then(() => router.push(back))
              .catch((e: unknown) =>
                setError(
                  e instanceof ApiError ? e.message : t("No se pudo borrar", "Couldn't delete"),
                ),
              )
          }
        >
          <IconTrash size={13} /> {t("Borrar la partida", "Delete the game")}
        </button>
      )}
    </main>
  );
}
