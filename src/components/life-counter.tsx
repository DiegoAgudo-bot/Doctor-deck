"use client";

/* eslint-disable @next/next/no-img-element -- símbolos de maná servidos desde /symbols */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  changeCommander,
  partnerDamage,
  setPartner,
  changeLife,
  changePoison,
  isOut,
  lastStanding,
  LETHAL_COMMANDER,
  LETHAL_POISON,
  MAX_PLAYERS,
  MIN_PLAYERS,
  newLifeGame,
  nextTurn,
  PLAYER_COLORS,
  rematch,
  setConceded,
  type LifeGame,
  type PlayerColor,
} from "@/domain/play/life";
import type { MyProfileDTO } from "@/server/dto";
import type { GroupDTO, GroupSummaryDTO } from "@/server/social-dto";
import { api, storage } from "./api-client";
import { authClient } from "./auth-client";
import { IconX } from "./icons";
import { SYMBOL_URL } from "./mana";
import { RecordGameDialog } from "./record-game-dialog";

const KEY = "deck-doctor:life";

interface Stored {
  game: LifeGame | null;
  names: string[];
  count: number;
  life: number;
  groupId: string;
}

const DEFAULTS: Stored = { game: null, names: [], count: 4, life: 40, groupId: "" };

/** Repite la acción mientras se mantiene pulsado (tras 400 ms, cada 110 ms). */
function useHold(action: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef(action);
  useEffect(() => {
    ref.current = action;
  });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      ref.current();
      const loop = (delay: number) => {
        timer.current = setTimeout(() => {
          ref.current();
          loop(110);
        }, delay);
      };
      loop(400);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

/**
 * Pulsar suma 1 (al soltar); mantener pulsado suma 10 a los 400 ms y otros 10 cada 600 ms
 * mientras se siga pulsando.
 */
function useLifeHold(step: (n: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const ref = useRef(step);
  useEffect(() => {
    ref.current = step;
  });
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      held.current = false;
      clear();
      const loop = (delay: number) => {
        timer.current = setTimeout(() => {
          held.current = true;
          ref.current(10);
          loop(600);
        }, delay);
      };
      loop(400);
    },
    onPointerUp: () => {
      if (timer.current && !held.current) ref.current(1);
      clear();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

/** Disposición de la mesa: cuántos arriba (girados) y cuántos abajo, en una rejilla de 6. */
function layout(n: number) {
  const top = n === 3 ? 1 : Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const isTop = i < top;
    return { rotated: isTop, span: 6 / (isTop ? top : n - top) };
  });
}

function PlayerTile({
  game,
  index,
  rotated,
  span,
  onChange,
}: {
  game: LifeGame;
  index: number;
  rotated: boolean;
  span: number;
  onChange: (g: LifeGame) => void;
}) {
  const p = game.players[index]!;
  const [panel, setPanel] = useState(false);
  // Lo ganado/perdido seguido: se ve mientras se sigue pulsando y se va 1,3 s después del último.
  const [delta, setDelta] = useState<{ n: number; key: number; leaving: boolean } | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  });
  useEffect(() => {
    if (!delta) return;
    const t = delta.leaving
      ? setTimeout(() => setDelta(null), 300)
      : setTimeout(() => setDelta((x) => x && { ...x, leaving: true }), 1300);
    return () => clearTimeout(t);
  }, [delta]);

  const bump = (d: number) => {
    onChange(changeLife(gameRef.current, index, d));
    setDelta((x) => ({ n: (x?.n ?? 0) + d, key: x?.key ?? Date.now(), leaving: false }));
  };
  const minus = useLifeHold((n) => bump(-n));
  const plus = useLifeHold((n) => bump(n));
  const out = isOut(p);
  const cmd2 = partnerDamage(p);
  const cmdTotal = [...p.commander, ...cmd2].reduce((a, b) => a + b, 0);
  const worstCmd = Math.max(0, ...p.commander, ...cmd2);
  // Un contador por comandante rival (dos si juega con pareja).
  const sources = game.players.flatMap((from, j) =>
    j === index
      ? []
      : (from.partner ? ([0, 1] as const) : ([0] as const)).map((slot) => ({
          from,
          j,
          slot,
          value: (slot === 0 ? p.commander : cmd2)[j] ?? 0,
        })),
  );

  return (
    <section
      className={`lifetile life-${p.color} ${out ? "is-out" : ""} ${game.active === index ? "is-active" : ""}`}
      style={{ gridColumn: `span ${span}`, gridRow: rotated ? 1 : 3 }}
      aria-label={`${p.name}: ${p.life} vidas`}
    >
      <div className={`lifetile-inner ${rotated ? "is-rotated" : ""}`}>
        <div className="lifetile-head">
          <span className="lifetile-name">{p.name}</span>
          {game.active === index && !out && <span className="lifetile-turn">Su turno</span>}
        </div>

        <button
          type="button"
          className="lifezone lifezone-minus"
          aria-label="Quitar una vida"
          {...minus}
        >
          <span>−</span>
        </button>
        <button
          type="button"
          className="lifezone lifezone-plus"
          aria-label="Sumar una vida"
          {...plus}
        >
          <span>+</span>
        </button>

        <div className="lifetile-life" aria-live="polite">
          {delta && (
            <span
              key={delta.key}
              className={`lifedelta ${delta.n >= 0 ? "up" : "down"}${delta.leaving ? " leaving" : ""}`}
            >
              {delta.n > 0 ? `+${delta.n}` : delta.n}
            </span>
          )}
          <b>{p.life}</b>
          {out && <span className="lifetile-out">Eliminado</span>}
        </div>

        <div className="lifetile-foot">
          {p.poison > 0 && (
            <span
              className={`lifechip ${p.poison >= LETHAL_POISON - 3 ? "danger" : ""}`}
              title="Veneno"
            >
              <img src={`${SYMBOL_URL}P.svg`} alt="" /> {p.poison}
            </span>
          )}
          {cmdTotal > 0 && (
            <span
              className={`lifechip ${worstCmd >= LETHAL_COMMANDER - 5 ? "danger" : ""}`}
              title="Daño de comandante (el máximo de un solo comandante)"
            >
              ⚔ {worstCmd}
            </span>
          )}
          <button
            type="button"
            className="lifechip lifechip-btn"
            onClick={() => setPanel(true)}
            aria-label={`Daño de comandante y veneno de ${p.name}`}
          >
            ⚔ ☠ …
          </button>
        </div>

        {panel && (
          <div className="lifepanel" role="dialog" aria-label={`Contadores de ${p.name}`}>
            <div className="lifepanel-head">
              <b>{p.name}</b>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Cerrar"
                onClick={() => setPanel(false)}
              >
                <IconX size={14} />
              </button>
            </div>
            <div className="lifepanel-grid">
              {sources.map(({ from, j, slot, value }) => (
                <Counter
                  key={`${j}-${slot}`}
                  label={`⚔ ${from.name}${from.partner ? ` ${slot + 1}` : ""}`}
                  color={from.color}
                  value={value}
                  danger={value >= LETHAL_COMMANDER - 5}
                  onDelta={(d) => onChange(changeCommander(gameRef.current, index, j, d, slot))}
                />
              ))}
              <Counter
                label="Veneno"
                value={p.poison}
                danger={p.poison >= LETHAL_POISON - 3}
                onDelta={(d) => onChange(changePoison(gameRef.current, index, d))}
              />
            </div>
            <label className="check text-[13px]">
              <input
                type="checkbox"
                checked={p.partner ?? false}
                onChange={(e) => onChange(setPartner(gameRef.current, index, e.target.checked))}
              />
              <span>Juega con dos comandantes</span>
            </label>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onChange(setConceded(gameRef.current, index, !p.conceded))}
            >
              {p.conceded ? "Vuelve a la partida" : "Concede"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Counter({
  label,
  value,
  onDelta,
  color,
  danger,
}: {
  label: string;
  value: number;
  onDelta: (d: number) => void;
  color?: PlayerColor;
  danger: boolean;
}) {
  const minus = useHold(() => onDelta(-1));
  const plus = useHold(() => onDelta(1));
  return (
    <div className={`lifecounter ${danger ? "danger" : ""}`}>
      <span className="lifecounter-label">
        {color && <i className={`dot life-dot-${color}`} />}
        {label}
      </span>
      <div className="lifecounter-row">
        <button type="button" className="btn btn-icon" aria-label="Menos" {...minus}>
          −
        </button>
        <b className="mono">{value}</b>
        <button type="button" className="btn btn-icon" aria-label="Más" {...plus}>
          +
        </button>
      </div>
    </div>
  );
}

/** Contador de vidas de Commander a pantalla completa, para jugar con el móvil en la mesa. */
export function LifeCounter() {
  const router = useRouter();
  const { data } = authClient.useSession();
  const loggedIn = !!data?.user;
  const [s, setS] = useState<Stored>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupSummaryDTO[]>([]);
  const [menu, setMenu] = useState(false);
  const [record, setRecord] = useState(false);
  const [dismissed, setDismissed] = useState<number | null>(null);
  /** Reloj de la mesa (minutos de partida), cada 30 s. */
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado guardado en el navegador
    setS({ ...DEFAULTS, ...storage.get<Partial<Stored>>(KEY, {}) });
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) storage.set(KEY, s);
  }, [s, hydrated]);

  useEffect(() => {
    if (!loggedIn) return;
    api<MyProfileDTO>("/api/me/profile", undefined, { silent: true })
      .then((p) => {
        setMe(p.username);
        setS((x) => (x.names[0] ? x : { ...x, names: [`@${p.username}`, ...x.names.slice(1)] }));
      })
      .catch(() => undefined);
    api<GroupSummaryDTO[]>("/api/groups", undefined, { silent: true })
      .then(setGroups)
      .catch(() => undefined);
  }, [loggedIn]);

  // Con la mesa abierta, que no se apague la pantalla.
  const playing = s.game !== null;
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    // El navegador suelta el bloqueo al cambiar de pestaña o apagar la pantalla: al volver, otra vez.
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [playing]);

  const names = Array.from({ length: s.count }, (_, i) => s.names[i] ?? "");
  const setName = (i: number, v: string) =>
    setS((x) => {
      const n = [...names];
      n[i] = v;
      return { ...x, names: n };
    });

  async function pickGroup(id: string) {
    setS((x) => ({ ...x, groupId: id }));
    if (!id) return;
    const g = await api<GroupDTO>(`/api/groups/${id}`).catch(() => null);
    if (!g) return;
    const members = g.members.flatMap((m) => (m.username ? [`@${m.username}`] : []));
    // Yo primero; el resto, por orden de entrada.
    const ordered = me ? [`@${me}`, ...members.filter((m) => m !== `@${me}`)] : members;
    const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.min(ordered.length, s.count)));
    setS((x) => ({ ...x, groupId: id, count, names: ordered.slice(0, MAX_PLAYERS) }));
  }

  const setGame = (game: LifeGame | null) => setS((x) => ({ ...x, game }));
  const winner = s.game ? lastStanding(s.game) : null;

  if (!hydrated) return <main className="page" />;

  if (!s.game) {
    return (
      <main className="page" style={{ gap: 18 }}>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Contador de vidas</span>
          <h1 className="h1">A jugar</h1>
          <p className="muted text-[13px]">
            Vidas, daño de comandante y veneno, a pantalla completa en el móvil. Al acabar, registra
            la partida para la clasificación de tu grupo.
          </p>
        </div>

        <div className="panel flex flex-col gap-4 p-4">
          <div className="field">
            <span className="label">Jugadores</span>
            <div className="chips">
              {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chipbtn ${s.count === n ? "is-on" : ""}`}
                    aria-pressed={s.count === n}
                    onClick={() => setS((x) => ({ ...x, count: n }))}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="field">
            <span className="label">Vidas</span>
            <div className="chips">
              {[20, 30, 40].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chipbtn ${s.life === n ? "is-on" : ""}`}
                  aria-pressed={s.life === n}
                  onClick={() => setS((x) => ({ ...x, life: n }))}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {groups.length > 0 && (
            <label className="field">
              <span className="label">Grupo</span>
              <select
                className="select"
                value={s.groupId}
                onChange={(e) => void pickGroup(e.target.value)}
              >
                <option value="">Sin grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="field">
            <span className="label">Nombres</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {names.map((n, i) => (
                <label key={i} className="lifename">
                  <i className={`dot life-dot-${PLAYER_COLORS[i % PLAYER_COLORS.length]}`} />
                  <input
                    className="input"
                    placeholder={`Jugador ${i + 1}`}
                    value={n}
                    maxLength={40}
                    onChange={(e) => setName(i, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setDismissed(null);
              setGame(newLifeGame(names, s.life));
            }}
          >
            Empezar partida
          </button>
        </div>
      </main>
    );
  }

  const game = s.game;
  const seats = layout(game.players.length);
  const minutes = Math.max(0, Math.round((now - game.startedAt) / 60000));

  return (
    <div className="lifetable" data-players={game.players.length}>
      {game.players.map((_, i) => (
        <PlayerTile
          key={i}
          game={game}
          index={i}
          rotated={seats[i]!.rotated}
          span={seats[i]!.span}
          onChange={setGame}
        />
      ))}

      <div className="lifehub">
        <button
          type="button"
          className="lifehub-btn"
          aria-label="Menú"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
        >
          ≡
        </button>
        <button type="button" className="lifehub-turn" onClick={() => setGame(nextTurn(game))}>
          <span>T{game.turn}</span>
          <small>Pasar turno</small>
        </button>
      </div>

      {menu && (
        <div className="lifemenu" role="menu">
          <span className="subtle text-xs">
            Turno {game.turn} · {minutes} min
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMenu(false);
              setRecord(true);
            }}
          >
            Registrar partida
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMenu(false);
              setDismissed(null);
              setGame(rematch(game));
            }}
          >
            Revancha (mismos jugadores)
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setMenu(false);
              setGame(null);
            }}
          >
            Salir de la mesa
          </button>
        </div>
      )}

      {winner !== null && dismissed !== game.startedAt && !record && (
        <div className="lifewin" role="dialog" aria-label="Fin de la partida">
          <span className="lifewin-crown">♛</span>
          <b>Gana {game.players[winner]!.name}</b>
          <span className="subtle">
            {game.turn} {game.turn === 1 ? "turno" : "turnos"} · {minutes} min
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {loggedIn ? (
              <button type="button" className="btn btn-primary" onClick={() => setRecord(true)}>
                Registrar partida
              </button>
            ) : (
              <Link className="btn btn-primary" href="/login?next=/play">
                Entra para registrarla
              </Link>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDismissed(null);
                setGame(rematch(game));
              }}
            >
              Revancha
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDismissed(game.startedAt)}
            >
              Seguir
            </button>
          </div>
        </div>
      )}

      {loggedIn && (
        <RecordGameDialog
          open={record}
          onClose={() => setRecord(false)}
          me={me}
          groupId={null}
          turns={game.turn}
          seats={game.players.map((p, i) => ({ name: p.name, winner: i === winner }))}
          onSaved={(id) => {
            setRecord(false);
            setGame(null);
            router.push(`/games/${id}`);
          }}
        />
      )}
    </div>
  );
}
