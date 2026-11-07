"use client";

import type { GameDTO, MemberDTO, StandingDTO } from "@/server/social-dto";
import { fmt } from "./ui";
import { Link, useIntlLocale, useLocale, useT } from "@/components/i18n";

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

const dateFmts = new Map<string, Intl.DateTimeFormat>();
/** "7 nov 2026" ("7 Nov 2026" en inglés). `intl`: el de `useIntlLocale()`. */
export const playedOn = (iso: string, intl = "es-ES") => {
  let f = dateFmts.get(intl);
  if (!f) {
    f = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" });
    dateFmts.set(intl, f);
  }
  return f.format(new Date(iso));
};

/** Una partida en una lista: fecha, grupo, jugadores (el ganador con corona) y mazos. */
export function GameCard({ game, showGroup = true }: { game: GameDTO; showGroup?: boolean }) {
  const t = useT();
  const intl = useIntlLocale();
  return (
    <Link href={`/games/${game.id}`} className="gamecard">
      <div className="gamecard-head">
        <span className="subtle text-xs">
          {playedOn(game.playedAt, intl)}
          {game.turns
            ? ` · ${game.turns} ${game.turns === 1 ? t("turno", "turn") : t("turnos", "turns")}`
            : ""}
          {showGroup && game.group ? ` · ${game.group.name}` : ""}
        </span>
        <span className="subtle text-xs">
          {game.players.length} {t("jugadores", "players")}
        </span>
      </div>
      <ul className="gamecard-players">
        {game.players.map((p) => (
          <li key={p.seat} className={p.winner ? "is-winner" : ""}>
            <span className="crown" aria-label={p.winner ? t("Ganador", "Winner") : undefined}>
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
const pctCss = (r: number) => `${Math.round(r * 100)}%`;

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
  const t = useT();
  const locale = useLocale();
  const shown = (r: number) => (locale === "en" ? pctCss(r) : pct(r));
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
                  {s.wins} {s.wins === 1 ? t("victoria", "win") : t("victorias", "wins")}
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
            <th>{kind === "player" ? t("Jugador", "Player") : t("Mazo", "Deck")}</th>
            <th className="num">{t("Partidas", "Games")}</th>
            <th className="num">{t("Ganadas", "Won")}</th>
            <th className="num">%</th>
            <th className="num hide-sm">{t("Racha", "Streak")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={`${s.name}-${i}`}>
              <td className="num subtle">{i + 1}</td>
              <td className="truncate">{name(s)}</td>
              <td className="num mono">{fmt(s.games, locale)}</td>
              <td className="num mono">{fmt(s.wins, locale)}</td>
              <td className="num">
                <span className="winbar" style={{ ["--w" as string]: pct(s.winRate) }}>
                  {shown(s.winRate)}
                </span>
              </td>
              <td
                className={`num mono hide-sm ${s.streak > 1 ? "text-in" : s.streak < -1 ? "text-out" : ""}`}
              >
                {s.streak > 0
                  ? `${s.streak}${t("V", "W")}`
                  : s.streak < 0
                    ? `${-s.streak}${t("D", "L")}`
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
