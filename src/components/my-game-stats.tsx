"use client";

import { useEffect, useState } from "react";
import type { GameStatsDTO } from "@/server/social-dto";
import { api } from "./api-client";
import { Standings } from "./games-ui";
import { fmt } from "./ui";
import { Link, useIntlLocale, useLocale, useT } from "@/components/i18n";

const pct = (r: number) => `${Math.round(r * 100)} %`;

/**
 * Mis estadísticas de partidas (en «Grupos y partidas»): récord y racha, partidas por mes, mis
 * mazos y con quién más juego. No sale nada hasta que hay alguna partida registrada.
 */
export function MyGameStats() {
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const [stats, setStats] = useState<GameStatsDTO | null>(null);

  useEffect(() => {
    let alive = true;
    api<GameStatsDTO>("/api/games", undefined, { silent: true })
      .then((s) => alive && setStats(s))
      .catch(() => {
        /* sin estadísticas: la página sigue con los grupos */
      });
    return () => {
      alive = false;
    };
  }, []);

  const me = stats?.me;
  if (!me?.record) return null;
  const r = me.record;
  const top = Math.max(1, ...me.months.map((m) => m.games));
  const monthName = (month: string) =>
    new Date(`${month}-15T00:00:00Z`).toLocaleDateString(intl, { month: "short", timeZone: "UTC" });
  const streak =
    r.streak > 0
      ? t(
          `${r.streak} ${r.streak === 1 ? "victoria seguida" : "victorias seguidas"}`,
          `${r.streak} ${r.streak === 1 ? "win" : "wins"} in a row`,
        )
      : t(
          `${-r.streak} ${r.streak === -1 ? "partida" : "partidas"} sin ganar`,
          `${-r.streak} ${r.streak === -1 ? "game" : "games"} without a win`,
        );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="my-stats">
      <h2 id="my-stats" className="h2">
        {t("Tus estadísticas", "Your stats")}
      </h2>
      <div className="panel mystats">
        <div className="mystats-record">
          <span className="mystats-big">{pct(r.winRate)}</span>
          <span className="muted text-[13px]">
            {t(
              `${fmt(r.wins, locale)} ganadas de ${fmt(r.games, locale)}`,
              `${fmt(r.wins, locale)} won out of ${fmt(r.games, locale)}`,
            )}
          </span>
          <span className={`text-[13px] ${r.streak > 1 ? "text-in" : "subtle"}`}>{streak}</span>
        </div>
        {me.months.length > 1 && (
          <div
            className="mystats-months"
            role="img"
            aria-label={t(
              `Partidas por mes: ${me.months.map((m) => `${monthName(m.month)} ${m.games} (${m.wins} ganadas)`).join(", ")}`,
              `Games per month: ${me.months.map((m) => `${monthName(m.month)} ${m.games} (${m.wins} won)`).join(", ")}`,
            )}
          >
            {me.months.map((m) => (
              <div
                key={m.month}
                className="mystats-month"
                title={t(
                  `${monthName(m.month)}: ${m.games} jugadas, ${m.wins} ganadas`,
                  `${monthName(m.month)}: ${m.games} played, ${m.wins} won`,
                )}
              >
                <div className="mystats-bar" style={{ height: `${(m.games / top) * 100}%` }}>
                  <i style={{ height: m.games ? `${(m.wins / m.games) * 100}%` : 0 }} />
                </div>
                <span>{monthName(m.month)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        className="grid-1-sm grid gap-3"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <div className="panel">
          <div className="panel-h">
            <span className="h2">{t("Tus mazos", "Your decks")}</span>
          </div>
          <div className="overflow-x-auto p-3">
            <Standings
              rows={me.decks}
              kind="deck"
              empty={t(
                "Al registrar una partida, di con qué mazo jugaste para verlo aquí.",
                "When you record a game, say which deck you played to see it here.",
              )}
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-h">
            <span className="h2">{t("Con quién juegas", "Who you play with")}</span>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="table standings">
              <thead>
                <tr>
                  <th>{t("Rival", "Opponent")}</th>
                  <th className="num">{t("Partidas", "Games")}</th>
                  <th className="num">{t("Ganas tú", "You win")}</th>
                  <th className="num">{t("Gana", "They win")}</th>
                </tr>
              </thead>
              <tbody>
                {me.rivals.slice(0, 10).map((x, i) => (
                  <tr key={`${x.name}-${i}`}>
                    <td className="truncate">
                      {x.username ? <Link href={`/u/${x.username}`}>{x.name}</Link> : x.name}
                    </td>
                    <td className="num mono">{fmt(x.games, locale)}</td>
                    <td className="num mono">{fmt(x.myWins, locale)}</td>
                    <td className="num mono">{fmt(x.theirWins, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
