import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { CardDTO } from "@/server/dto";
import type { GameDTO, MemberDTO, StandingDTO } from "@/server/social-dto";
import { api } from "~/lib/api";
import { useDebounced } from "~/lib/hooks";
import { colors, radius } from "~/lib/theme";
import { CardThumb } from "./card-bits";
import { Avatar } from "./social";
import { Chip, SearchField, T } from "./ui";

export const memberLabel = (m: MemberDTO) => (m.username ? `@${m.username}` : m.name);

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
export const playedOn = (iso: string) => dateFmt.format(new Date(iso));
const pct = (r: number) => `${Math.round(r * 100)} %`;

/** Una partida en una lista: fecha, grupo, jugadores (el ganador con corona) y mazos. */
export function GameCard({ game, showGroup = true }: { game: GameDTO; showGroup?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/games/${game.id}`)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.hover : colors.panel,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.line,
        padding: 12,
        gap: 6,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
          {playedOn(game.playedAt)}
          {game.turns ? ` · ${game.turns} ${game.turns === 1 ? "turno" : "turnos"}` : ""}
          {showGroup && game.group ? ` · ${game.group.name}` : ""}
        </T>
        <T variant="small">{game.players.length} jugadores</T>
      </View>
      {game.players.map((p) => (
        <View key={p.seat} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T style={{ width: 18, color: colors.warn }}>{p.winner ? "♛" : ""}</T>
          <T style={{ fontWeight: p.winner ? "700" : "400" }} numberOfLines={1}>
            {p.user ? memberLabel(p.user) : p.guestName}
          </T>
          <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {p.deckName || "—"}
          </T>
        </View>
      ))}
      {game.notes ? (
        <T variant="small" style={{ fontStyle: "italic" }} numberOfLines={2}>
          “{game.notes}”
        </T>
      ) : null}
    </Pressable>
  );
}

/** Clasificación de jugadores o de mazos (victorias, partidas, % y racha). */
export function Standings({
  rows,
  kind,
  empty,
}: {
  rows: StandingDTO[];
  kind: "player" | "deck";
  empty: string;
}) {
  if (rows.length === 0) return <T variant="muted">{empty}</T>;
  return (
    <View>
      {rows.map((s, i) => {
        const target =
          kind === "player" && s.username
            ? `/u/${s.username}`
            : kind === "deck" && s.deckId
              ? `/deck/${s.deckId}`
              : null;
        return (
          <Pressable
            key={`${s.name}-${i}`}
            disabled={!target}
            onPress={() => target && router.push(target as never)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              backgroundColor: pressed ? colors.hover : "transparent",
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            })}
          >
            <T
              variant="mono"
              style={{
                width: 22,
                textAlign: "right",
                color: i < 3 ? [colors.warn, colors.text2, "#c08457"][i] : colors.text3,
                fontWeight: i < 3 ? "700" : "400",
              }}
            >
              {i + 1}
            </T>
            {kind === "player" && <Avatar name={s.name.replace(/^@/, "")} size={28} />}
            <View style={{ flex: 1 }}>
              <T numberOfLines={1} style={target ? { color: colors.accent } : undefined}>
                {s.name}
              </T>
              <T variant="small">
                {s.games} {s.games === 1 ? "partida" : "partidas"} · {s.wins}{" "}
                {s.wins === 1 ? "victoria" : "victorias"}
              </T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T variant="mono" style={{ color: colors.text, fontWeight: "700" }}>
                {pct(s.winRate)}
              </T>
              <T
                variant="small"
                style={{
                  color: s.streak > 1 ? colors.in : s.streak < -1 ? colors.out : colors.text3,
                }}
              >
                {s.streak > 0 ? `${s.streak}V` : s.streak < 0 ? `${-s.streak}D` : "—"}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Jugadores | Mazos sobre una clasificación. */
export function StandingsBlock({
  players,
  decks,
  empty,
}: {
  players: StandingDTO[];
  decks: StandingDTO[];
  empty: string;
}) {
  const [kind, setKind] = useState<"player" | "deck">("player");
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Chip label="Jugadores" active={kind === "player"} onPress={() => setKind("player")} />
        <Chip label="Mazos" active={kind === "deck"} onPress={() => setKind("deck")} />
      </View>
      <Standings rows={kind === "player" ? players : decks} kind={kind} empty={empty} />
    </View>
  );
}

/** Buscar una carta por nombre y elegirla (¿quién tiene…?, prestar…). */
export function CardPicker({
  label,
  onPick,
  placeholder = "Nombre de la carta",
}: {
  label?: string;
  onPick: (card: CardDTO) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 250);
  const found = useQuery({
    queryKey: ["card-search", query],
    queryFn: () => api<CardDTO[]>(`/api/cards/search?q=${encodeURIComponent(query)}&limit=8`),
    enabled: query.length >= 2,
  });
  return (
    <View style={{ gap: 6 }}>
      {label && <T variant="label">{label}</T>}
      <SearchField
        placeholder={placeholder}
        value={q}
        onChangeText={setQ}
        onClear={() => setQ("")}
      />
      {query.length >= 2 &&
        (found.data ?? []).map((c) => (
          <Pressable
            key={c.oracleId}
            onPress={() => {
              setQ("");
              onPick(c);
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 6,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.hover : "transparent",
            })}
          >
            <CardThumb uri={c.imageUrl} width={32} name={c.name} />
            <View style={{ flex: 1 }}>
              <T numberOfLines={1}>{c.name}</T>
              <T variant="small" numberOfLines={1}>
                {c.typeLine}
              </T>
            </View>
          </Pressable>
        ))}
    </View>
  );
}
