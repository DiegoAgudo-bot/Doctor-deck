/** Una partida para las estadísticas: quién jugó, con qué mazo y quién ganó. */
export interface GameResult {
  playedAt: Date;
  players: {
    /** Identifica al jugador: id de usuario o "guest:<nombre>". */
    key: string;
    name: string;
    /** Identifica el mazo: id público del mazo guardado o, si no, su nombre; null = sin mazo. */
    deckKey: string | null;
    deckName: string;
    winner: boolean;
  }[];
}

export interface Standing {
  key: string;
  name: string;
  games: number;
  wins: number;
  /** wins / games (0..1). */
  winRate: number;
  /** Victorias (+) o derrotas (−) seguidas en sus últimas partidas. */
  streak: number;
  lastPlayed: Date;
}

/** Ganadas, jugadas y racha de cada clave (jugador o mazo), de la más reciente a la más vieja. */
function standings(
  games: readonly GameResult[],
  entries: (g: GameResult) => { key: string; name: string; winner: boolean }[],
): Standing[] {
  const byKey = new Map<string, Standing & { streakOpen: boolean }>();
  const newestFirst = [...games].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  for (const g of newestFirst) {
    // Si el mismo jugador (o mazo) aparece dos veces en una partida, cuenta una.
    const seen = new Set<string>();
    for (const e of entries(g)) {
      if (seen.has(e.key)) continue;
      seen.add(e.key);
      const s = byKey.get(e.key) ?? {
        key: e.key,
        name: e.name,
        games: 0,
        wins: 0,
        winRate: 0,
        streak: 0,
        lastPlayed: g.playedAt,
        streakOpen: true,
      };
      s.games++;
      if (e.winner) s.wins++;
      if (s.streakOpen) {
        const sign = e.winner ? 1 : -1;
        if (s.streak === 0 || Math.sign(s.streak) === sign) s.streak += sign;
        else s.streakOpen = false;
      }
      byKey.set(e.key, s);
    }
  }
  return [...byKey.values()]
    .map((s): Standing => ({
      key: s.key,
      name: s.name,
      games: s.games,
      wins: s.wins,
      winRate: s.games ? s.wins / s.games : 0,
      streak: s.streak,
      lastPlayed: s.lastPlayed,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.games - a.games ||
        a.name.localeCompare(b.name, "es"),
    );
}

/** Clasificación de jugadores: más victorias, luego mejor % y más partidas. */
export const playerStandings = (games: readonly GameResult[]) =>
  standings(games, (g) => g.players.map((p) => ({ key: p.key, name: p.name, winner: p.winner })));

/** Lo mismo por mazo (solo los jugadores que dijeron con qué mazo jugaban). */
export const deckStandings = (games: readonly GameResult[]) =>
  standings(games, (g) =>
    g.players.flatMap((p) =>
      p.deckKey === null ? [] : [{ key: p.deckKey, name: p.deckName, winner: p.winner }],
    ),
  );

/** Resumen de un jugador o mazo concreto (null si no ha jugado). */
export function recordOf(standings: readonly Standing[], key: string): Standing | null {
  return standings.find((s) => s.key === key) ?? null;
}
