/** Contador de vidas de Commander (puro: el estado se guarda en el navegador). */

export const PLAYER_COLORS = ["w", "u", "b", "r", "g", "c"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface LifePlayer {
  name: string;
  color: PlayerColor;
  life: number;
  poison: number;
  /** Daño de comandante recibido de cada asiento (índice del jugador que lo hizo). */
  commander: number[];
  /** Juega con dos comandantes (parejas, trasfondo…): cada uno lleva su propio daño. */
  partner?: boolean;
  /** Daño recibido del segundo comandante de cada asiento (solo cuenta si ese jugador tiene pareja). */
  commander2?: number[];
  /** Eliminado a mano (concede, se va…), aunque le quede vida. */
  conceded: boolean;
}

export interface LifeGame {
  startingLife: number;
  players: LifePlayer[];
  /** Asiento del jugador al que le toca y número de turno (empieza en 1). */
  active: number;
  turn: number;
  startedAt: number;
}

export const LETHAL_POISON = 10;
export const LETHAL_COMMANDER = 21;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export function newLifeGame(names: readonly string[], startingLife = 40, now = Date.now()) {
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, names.length));
  const players = Array.from({ length: n }, (_, i) => ({
    name: names[i]?.trim() || `Jugador ${i + 1}`,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]!,
    life: startingLife,
    poison: 0,
    commander: Array.from({ length: n }, () => 0),
    conceded: false,
  }));
  return { startingLife, players, active: 0, turn: 1, startedAt: now } satisfies LifeGame;
}

const update = (g: LifeGame, i: number, f: (p: LifePlayer) => LifePlayer): LifeGame =>
  g.players[i] ? { ...g, players: g.players.map((p, j) => (j === i ? f(p) : p)) } : g;

export const changeLife = (g: LifeGame, i: number, delta: number) =>
  update(g, i, (p) => ({ ...p, life: p.life + delta }));

export const changePoison = (g: LifeGame, i: number, delta: number) =>
  update(g, i, (p) => ({ ...p, poison: Math.max(0, p.poison + delta) }));

/** Daño recibido del segundo comandante de cada asiento (los estados viejos no lo traen). */
export const partnerDamage = (p: LifePlayer) => p.commander2 ?? p.commander.map(() => 0);

/**
 * Daño de comandante de `from` a `to` (`slot` 1 = su segundo comandante): también resta (o
 * devuelve) vida.
 */
export function changeCommander(
  g: LifeGame,
  to: number,
  from: number,
  delta: number,
  slot: 0 | 1 = 0,
) {
  const target = g.players[to];
  const row = target && (slot === 0 ? target.commander : partnerDamage(target));
  const current = row?.[from];
  if (current === undefined || to === from) return g;
  if (slot === 1 && !g.players[from]?.partner) return g;
  const next = Math.max(0, current + delta);
  const applied = next - current;
  const updated = row!.map((d, j) => (j === from ? next : d));
  return update(g, to, (p) => ({
    ...p,
    life: p.life - applied,
    ...(slot === 0 ? { commander: updated } : { commander2: updated }),
  }));
}

/** Marca que un jugador juega con dos comandantes (o deja de hacerlo). */
export const setPartner = (g: LifeGame, i: number, partner: boolean) =>
  update(g, i, (p) => ({ ...p, partner }));

export const setConceded = (g: LifeGame, i: number, conceded: boolean) =>
  update(g, i, (p) => ({ ...p, conceded }));

export const renamePlayer = (g: LifeGame, i: number, name: string) =>
  update(g, i, (p) => ({ ...p, name: name.slice(0, 40) }));

export function isOut(p: LifePlayer) {
  return (
    p.conceded ||
    p.life <= 0 ||
    p.poison >= LETHAL_POISON ||
    p.commander.some((d) => d >= LETHAL_COMMANDER) ||
    (p.commander2 ?? []).some((d) => d >= LETHAL_COMMANDER)
  );
}

/** Pasa el turno al siguiente jugador vivo (suma un turno al dar la vuelta a la mesa). */
export function nextTurn(g: LifeGame): LifeGame {
  const n = g.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (g.active + step) % n;
    if (!isOut(g.players[i]!)) {
      return { ...g, active: i, turn: g.turn + (i <= g.active ? 1 : 0) };
    }
  }
  return g;
}

/** El ganador si solo queda uno en pie; null si la partida sigue (o no queda nadie). */
export function lastStanding(g: LifeGame): number | null {
  const alive = g.players.flatMap((p, i) => (isOut(p) ? [] : [i]));
  return alive.length === 1 ? alive[0]! : null;
}

/** Misma mesa, vidas a cero: nueva partida con los mismos jugadores. */
export const rematch = (g: LifeGame, now = Date.now()) => {
  const fresh = newLifeGame(
    g.players.map((p) => p.name),
    g.startingLife,
    now,
  );
  return {
    ...fresh,
    players: fresh.players.map((p, i) => ({
      ...p,
      color: g.players[i]!.color,
      ...(g.players[i]!.partner ? { partner: true } : {}),
    })),
  };
};
