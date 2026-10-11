"use client";

import Link from "next/link";
import type { GameDTO, MemberDTO, StandingDTO } from "@/server/social-dto";
import { fmt } from "./ui";

/** Inicial en un círculo (no hay fotos de perfil). */
export function Avatar({
  m,
  size = 28,
}: {
  m: { name: string; username?: string | null };
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {(m.name.trim()[0] ?? m.username?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

export const memberLabel = (m: MemberDTO) => (m.username ? `@${m.username}` : m.name);

export function MemberLink({ m }: { m: MemberDTO }) {
  return m.username ? <Link href={`/u/${m.username}`}>@{m.username}</Link> : <span>{m.name}</span>;
}

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
export const playedOn = (iso: string) => dateFmt.format(new Date(iso));

/** Una partida en una lista: fecha, grupo, jugadores (el ganador con corona) y mazos. */
export function GameCard({ game, showGroup = true }: { game: GameDTO; showGroup?: boolean }) {
  return (
    <Link href={`/games/${game.id}`} className="gamecard">
      <div className="gamecard-head">
        <span className="subtle text-xs">
          {playedOn(game.playedAt)}
          {game.turns ? ` · ${game.turns} ${game.turns === 1 ? "turno" : "turnos"}` : ""}
          {showGroup && game.group ? ` · ${game.group.name}` : ""}
        </span>
        <span className="subtle text-xs">{game.players.length} jugadores</span>
      </div>
      <ul className="gamecard-players">
        {game.players.map((p) => (
          <li key={p.seat} className={p.winner ? "is-winner" : ""}>
            <span className="crown" aria-label={p.winner ? "Ganador" : undefined}>
              {p.winner ? "♛" : ""}
            </span>
            <b>{p.user ? memberLabel(p.user) : p.guestName}</b>
            <span className="subtle">{p.deckName || "—"}</span>
          </li>
        ))}
      </ul>
      {game.notes && <p className="gamecard-notes">“{game.notes}”</p>}
    </Link>
  );
}

const pct = (r: number) => `${Math.round(r * 100)} %`;

/** Clasificación (jugadores o mazos): podio para los tres primeros y tabla para el resto. */
export function Standings({
  rows,
  kind,
  empty,
}: {
  rows: StandingDTO[];
  kind: "player" | "deck";
  empty: string;
}) {
  if (rows.length === 0) return <p className="muted text-[13px]">{empty}</p>;
  const name = (s: StandingDTO) =>
    kind === "player" && s.username ? (
      <Link href={`/u/${s.username}`}>{s.name}</Link>
    ) : kind === "deck" && s.deckId ? (
      <Link href={`/decks/${s.deckId}`}>{s.name}</Link>
    ) : (
      <span>{s.name}</span>
    );
  return (
    <div className="flex flex-col gap-3">
      {kind === "player" && rows.length >= 2 && (
        <div className="podium">
          {[1, 0, 2].map((i) => {
            const s = rows[i];
            return s ? (
              <div key={i} className={`podium-step p${i + 1}`}>
                <Avatar m={{ name: s.name.replace(/^@/, "") }} size={i === 0 ? 52 : 42} />
                <b className="truncate">{name(s)}</b>
                <span className="mono">
                  {s.wins} {s.wins === 1 ? "victoria" : "victorias"}
                </span>
                <div className="podium-block">{i + 1}</div>
              </div>
            ) : (
              <div key={i} />
            );
          })}
        </div>
      )}
      <table className="table standings">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>{kind === "player" ? "Jugador" : "Mazo"}</th>
            <th className="num">Partidas</th>
            <th className="num">Ganadas</th>
            <th className="num">%</th>
            <th className="num hide-sm">Racha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={`${s.name}-${i}`}>
              <td className="num subtle">{i + 1}</td>
              <td className="truncate">{name(s)}</td>
              <td className="num mono">{fmt(s.games)}</td>
              <td className="num mono">{fmt(s.wins)}</td>
              <td className="num">
                <span className="winbar" style={{ ["--w" as string]: pct(s.winRate) }}>
                  {pct(s.winRate)}
                </span>
              </td>
              <td
                className={`num mono hide-sm ${s.streak > 1 ? "text-in" : s.streak < -1 ? "text-out" : ""}`}
              >
                {s.streak > 0 ? `${s.streak}V` : s.streak < 0 ? `${-s.streak}D` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
