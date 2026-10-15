import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useKeepAwake } from "expo-keep-awake";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  changeCommander,
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
import { RecordGameSheet } from "~/components/record-game";
import { Sheet } from "~/components/sheet";
import { Button, Chip, T, styles } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { LIFE_KEY } from "~/lib/life-store";
import { colors, radius } from "~/lib/theme";

interface Stored {
  game: LifeGame | null;
  names: string[];
  count: number;
  life: number;
  groupId: string;
}

const DEFAULTS: Stored = { game: null, names: [], count: 4, life: 40, groupId: "" };

/** Fondo de cada jugador (los colores de maná de la mesa de la web). */
const TILE: Record<PlayerColor, { bg: string; dot: string }> = {
  w: { bg: "#7d7450", dot: "#e8dfb8" },
  u: { bg: "#1f4f85", dot: "#5ea4e6" },
  b: { bg: "#3d3150", dot: "#9b8bb0" },
  r: { bg: "#87301d", dot: "#e2694a" },
  g: { bg: "#1f5c2e", dot: "#4fae63" },
  c: { bg: "#524d47", dot: "#b9b2a8" },
};

/** Repite la acción mientras se mantiene pulsado (tras 400 ms, cada 110 ms). */
function useHold(action: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef(action);
  ref.current = action;
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    onPressIn: () => {
      ref.current();
      const loop = (delay: number) => {
        timer.current = setTimeout(() => {
          ref.current();
          loop(110);
        }, delay);
      };
      loop(400);
    },
    onPressOut: stop,
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
  ref.current = step;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPressIn: () => {
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
    onPressOut: () => {
      if (timer.current && !held.current) ref.current(1);
      clear();
    },
  };
}

/** Con la mesa abierta, que no se apague la pantalla. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * Contador de vidas de Commander a pantalla completa (como `/play` en la web): 2–6 jugadores,
 * pulsar la mitad izquierda o derecha (mantener pulsado: de 10 en 10), daño de comandante, veneno, conceder,
 * turnos y revancha. Al quedar uno, se registra la partida.
 */
export default function Play() {
  const [s, setS] = useState<Stored>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MyProfileDTO>("/api/me/profile"),
  });
  const me = profile.data?.username ?? null;

  useEffect(() => {
    AsyncStorage.getItem(LIFE_KEY)
      .then((raw) => raw && setS({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Stored>) }))
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(LIFE_KEY, JSON.stringify(s)).catch(() => {});
  }, [s, hydrated]);
  // Yo en el primer asiento si aún no hay nombres.
  useEffect(() => {
    if (me) setS((x) => (x.names[0] ? x : { ...x, names: [`@${me}`, ...x.names.slice(1)] }));
  }, [me]);

  if (!hydrated) return <View style={styles.screen} />;
  if (!s.game) return <Setup s={s} setS={setS} me={me} />;
  return <Table game={s.game} me={me} setGame={(game) => setS((x) => ({ ...x, game }))} />;
}

function Setup({
  s,
  setS,
  me,
}: {
  s: Stored;
  setS: (f: (x: Stored) => Stored) => void;
  me: string | null;
}) {
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<GroupSummaryDTO[]>("/api/groups"),
  });
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
    setS((x) => {
      const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.min(ordered.length, x.count)));
      return { ...x, groupId: id, count, names: ordered.slice(0, MAX_PLAYERS) };
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: "Contador de vidas", headerShown: true }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <T variant="muted">
          Vidas, daño de comandante y veneno, a pantalla completa. Al acabar, registra la partida
          para la clasificación de tu grupo.
        </T>
        <View style={{ gap: 8 }}>
          <T variant="label">Jugadores</T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
              (n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  active={s.count === n}
                  onPress={() => setS((x) => ({ ...x, count: n }))}
                />
              ),
            )}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <T variant="label">Vidas</T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[20, 30, 40].map((n) => (
              <Chip
                key={n}
                label={String(n)}
                active={s.life === n}
                onPress={() => setS((x) => ({ ...x, life: n }))}
              />
            ))}
          </View>
        </View>
        {(groups.data?.length ?? 0) > 0 && (
          <View style={{ gap: 8 }}>
            <T variant="label">Grupo</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Chip label="Sin grupo" active={!s.groupId} onPress={() => void pickGroup("")} />
                {groups.data?.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.name}
                    active={s.groupId === g.id}
                    onPress={() => void pickGroup(g.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        <View style={{ gap: 8 }}>
          <T variant="label">Nombres</T>
          {names.map((n, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: TILE[PLAYER_COLORS[i % PLAYER_COLORS.length]!].dot,
                }}
              />
              <TextInput
                style={[styles.field, { flex: 1 }]}
                placeholder={`Jugador ${i + 1}`}
                placeholderTextColor={colors.text3}
                value={n}
                maxLength={40}
                autoCapitalize="none"
                onChangeText={(v) => setName(i, v)}
              />
            </View>
          ))}
        </View>
        <Button
          label="Empezar partida"
          icon="play"
          onPress={() => setS((x) => ({ ...x, game: newLifeGame(names, x.life) }))}
        />
      </ScrollView>
    </>
  );
}

/** Cuántos arriba (girados) y cuántos abajo. */
const topCount = (n: number) => (n === 3 ? 1 : Math.ceil(n / 2));

function Table({
  game,
  me,
  setGame,
}: {
  game: LifeGame;
  me: string | null;
  setGame: (g: LifeGame | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [record, setRecord] = useState(false);
  const [panel, setPanel] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // El estado más reciente para los toques repetidos (mantener pulsado).
  const gameRef = useRef(game);
  gameRef.current = game;
  const change = (f: (g: LifeGame) => LifeGame) => {
    // Se apunta ya: varios toques seguidos antes de pintar no se pisan.
    gameRef.current = f(gameRef.current);
    setGame(gameRef.current);
  };

  const n = game.players.length;
  const top = topCount(n);
  const winner = lastStanding(game);
  const minutes = Math.max(0, Math.round((now - game.startedAt) / 60000));
  const tiles = (from: number, to: number, rotated: boolean) => (
    <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
      {game.players.slice(from, to).map((_, k) => (
        <PlayerTile
          key={from + k}
          game={game}
          index={from + k}
          rotated={rotated}
          compact={n >= 5}
          change={change}
          openPanel={() => setPanel(from + k)}
        />
      ))}
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#08090a",
        paddingTop: insets.top + 6,
        paddingBottom: insets.bottom + 6,
        paddingHorizontal: 6,
        gap: 6,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <KeepAwake />
      {tiles(0, top, true)}

      <View
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menú"
          onPress={() => setMenu(true)}
          style={({ pressed }) => [hub, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>≡</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pasar turno"
          onPress={() => {
            tapFeedback();
            change(nextTurn);
          }}
          style={({ pressed }) => [hub, { paddingHorizontal: 18 }, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>T{game.turn}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Pasar turno</Text>
        </Pressable>
      </View>

      {tiles(top, n, false)}

      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={`Turno ${game.turn} · ${minutes} min`}
      >
        <Button
          label="Registrar partida"
          icon="trophy-outline"
          onPress={() => {
            setMenu(false);
            setRecord(true);
          }}
        />
        <Button
          label="Revancha (mismos jugadores)"
          icon="refresh"
          kind="secondary"
          onPress={() => {
            setMenu(false);
            setDismissed(null);
            setGame(rematch(game));
          }}
        />
        <Button
          label="Salir de la mesa"
          icon="exit-outline"
          kind="ghost"
          onPress={() => {
            setMenu(false);
            setGame(null);
          }}
        />
      </Sheet>

      {panel !== null && game.players[panel] && (
        <CountersSheet game={game} index={panel} change={change} onClose={() => setPanel(null)} />
      )}

      {winner !== null && dismissed !== game.startedAt && !record && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 48, color: colors.warn }}>♛</Text>
          <T variant="title" style={{ textAlign: "center" }}>
            Gana {game.players[winner]!.name}
          </T>
          <T variant="muted">
            {game.turn} {game.turn === 1 ? "turno" : "turnos"} · {minutes} min
          </T>
          <View style={{ gap: 8, alignSelf: "stretch", marginTop: 8 }}>
            <Button
              label="Registrar partida"
              icon="trophy-outline"
              onPress={() => setRecord(true)}
            />
            <Button
              label="Revancha"
              icon="refresh"
              kind="secondary"
              onPress={() => {
                setDismissed(null);
                setGame(rematch(game));
              }}
            />
            <Button label="Seguir" kind="ghost" onPress={() => setDismissed(game.startedAt)} />
          </View>
        </View>
      )}

      <RecordGameSheet
        open={record}
        onClose={() => setRecord(false)}
        me={me}
        turns={game.turn}
        seats={game.players.map((p, i) => ({ name: p.name, winner: i === winner }))}
        onSaved={(id) => {
          setRecord(false);
          setGame(null);
          router.replace(`/games/${id}`);
        }}
      />
    </View>
  );
}

const hub = {
  minHeight: 44,
  minWidth: 44,
  borderRadius: 22,
  backgroundColor: colors.raised,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 12,
};

function PlayerTile({
  game,
  index,
  rotated,
  compact,
  change,
  openPanel,
}: {
  game: LifeGame;
  index: number;
  rotated: boolean;
  compact: boolean;
  change: (f: (g: LifeGame) => LifeGame) => void;
  openPanel: () => void;
}) {
  const p = game.players[index]!;
  // Lo ganado/perdido seguido: se ve mientras se sigue pulsando y se va 1,6 s después del último.
  const [delta, setDelta] = useState<{ n: number } | null>(null);
  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 1600);
    return () => clearTimeout(t);
  }, [delta]);
  const bump = (d: number) => {
    change((g) => changeLife(g, index, d));
    setDelta((x) => ({ n: (x?.n ?? 0) + d }));
  };
  const minus = useLifeHold((n) => bump(-n));
  const plus = useLifeHold((n) => bump(n));
  const out = isOut(p);
  const active = game.active === index && !out;
  const cmdWorst = Math.max(0, ...p.commander);

  return (
    <View
      accessibilityLabel={`${p.name}: ${p.life} vidas`}
      style={{
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: TILE[p.color].bg,
        opacity: out ? 0.45 : 1,
        borderWidth: active ? 3 : 1,
        borderColor: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.08)",
      }}
    >
      <View style={{ flex: 1, transform: rotated ? [{ rotate: "180deg" }] : [] }}>
        {/* Las dos mitades: restar a la izquierda, sumar a la derecha. */}
        <View style={{ position: "absolute", inset: 0, flexDirection: "row" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar una vida"
            style={({ pressed }) => ({
              flex: 1,
              justifyContent: "center",
              paddingLeft: 14,
              backgroundColor: pressed ? "rgba(0,0,0,0.15)" : "transparent",
            })}
            {...minus}
          >
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 28 }}>−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sumar una vida"
            style={({ pressed }) => ({
              flex: 1,
              justifyContent: "center",
              alignItems: "flex-end",
              paddingRight: 14,
              backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "transparent",
            })}
            {...plus}
          >
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 28 }}>+</Text>
          </Pressable>
        </View>

        <View pointerEvents="none" style={{ padding: 10, flexDirection: "row", gap: 6 }}>
          <Text style={{ color: "#fff", fontWeight: "600", flex: 1 }} numberOfLines={1}>
            {p.name}
          </Text>
          {active && (
            <Text
              style={{
                color: "#111",
                backgroundColor: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: "700",
                paddingHorizontal: 6,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              Su turno
            </Text>
          )}
        </View>

        <View
          pointerEvents="none"
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {delta && (
            <Text
              style={{
                color: delta.n >= 0 ? "#b8f5c4" : "#ffc1b8",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              {delta.n > 0 ? `+${delta.n}` : delta.n}
            </Text>
          )}
          <Text
            style={{
              color: "#fff",
              fontSize: compact ? 52 : 72,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {p.life}
          </Text>
          {out && <Text style={{ color: "#fff", fontWeight: "700" }}>Eliminado</Text>}
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 6,
            padding: 8,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {p.poison > 0 && <Badge text={`☠ ${p.poison}`} danger={p.poison >= LETHAL_POISON - 3} />}
          {cmdWorst > 0 && (
            <Badge text={`⚔ ${cmdWorst}`} danger={cmdWorst >= LETHAL_COMMANDER - 5} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Daño de comandante y veneno de ${p.name}`}
            hitSlop={8}
            onPress={openPanel}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: pressed ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)",
            })}
          >
            <Text style={{ color: "#fff", fontSize: 13 }}>⚔ ☠ …</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Badge({ text, danger }: { text: string; danger: boolean }) {
  return (
    <Text
      style={{
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: danger ? "rgba(240,106,95,0.85)" : "rgba(0,0,0,0.3)",
      }}
    >
      {text}
    </Text>
  );
}

/** Daño de comandante de cada rival, veneno y conceder. */
function CountersSheet({
  game,
  index,
  change,
  onClose,
}: {
  game: LifeGame;
  index: number;
  change: (f: (g: LifeGame) => LifeGame) => void;
  onClose: () => void;
}) {
  const p = game.players[index]!;
  return (
    <Sheet open onClose={onClose} title={p.name}>
      {game.players.map((from, j) =>
        j === index ? null : (
          <Counter
            key={j}
            label={`⚔ ${from.name}`}
            dot={TILE[from.color].dot}
            value={p.commander[j] ?? 0}
            danger={(p.commander[j] ?? 0) >= LETHAL_COMMANDER - 5}
            onDelta={(d) => change((g) => changeCommander(g, index, j, d))}
          />
        ),
      )}
      <Counter
        label="☠ Veneno"
        value={p.poison}
        danger={p.poison >= LETHAL_POISON - 3}
        onDelta={(d) => change((g) => changePoison(g, index, d))}
      />
      <Button
        label={p.conceded ? "Vuelve a la partida" : "Concede"}
        kind="secondary"
        onPress={() => change((g) => setConceded(g, index, !p.conceded))}
      />
    </Sheet>
  );
}

function Counter({
  label,
  value,
  onDelta,
  dot,
  danger,
}: {
  label: string;
  value: number;
  onDelta: (d: number) => void;
  dot?: string;
  danger: boolean;
}) {
  const minus = useHold(() => onDelta(-1));
  const plus = useHold(() => onDelta(1));
  const btn = {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.raised,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: radius.md,
        backgroundColor: danger ? "rgba(240,106,95,0.15)" : "transparent",
      }}
    >
      {dot && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />}
      <T style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </T>
      <Pressable accessibilityLabel="Menos" style={btn} {...minus}>
        <T style={{ fontSize: 20 }}>−</T>
      </Pressable>
      <T style={{ minWidth: 28, textAlign: "center", fontWeight: "700", fontSize: 18 }}>{value}</T>
      <Pressable accessibilityLabel="Más" style={btn} {...plus}>
        <T style={{ fontSize: 20 }}>+</T>
      </Pressable>
    </View>
  );
}
