import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { LifeGame } from "@/domain/play/life";
import type { MyProfileDTO } from "@/server/dto";
import type { GameStatsDTO, GroupSummaryDTO } from "@/server/social-dto";
import { GameCard, playedOn } from "~/components/games";
import { RecordGameSheet } from "~/components/record-game";
import { Card, Meta, SectionTitle } from "~/components/social";
import { Button, T } from "~/components/ui";
import { api } from "~/lib/api";
import { openLifeGame } from "~/lib/life-store";
import { colors, radius } from "~/lib/theme";

/**
 * Pestaña «Jugar»: el contador de vidas (o seguir la partida abierta), mis grupos y las últimas
 * partidas, para tenerlo todo a un toque en la mesa.
 */
export default function Games() {
  const [open, setOpen] = useState<LifeGame | null>(null);
  const [record, setRecord] = useState(false);
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<GroupSummaryDTO[]>("/api/groups"),
  });
  const games = useQuery({
    queryKey: ["games", "mine"],
    queryFn: () => api<GameStatsDTO>("/api/games"),
  });
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MyProfileDTO>("/api/me/profile"),
  });

  // Al volver del contador, saber si la partida sigue abierta.
  useFocusEffect(
    useCallback(() => {
      openLifeGame().then(setOpen);
    }, []),
  );

  const myGroups = groups.data ?? [];
  const recent = games.data?.recent.slice(0, 3) ?? [];
  const minutes = open ? Math.max(0, Math.round((Date.now() - open.startedAt) / 60000)) : 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={groups.isRefetching || games.isRefetching}
          onRefresh={() => {
            groups.refetch();
            games.refetch();
          }}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Card style={{ gap: 12, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.raised,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="heart" size={22} color={colors.out} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h2">Contador de vidas</T>
              <T variant="small">
                {open
                  ? `Partida abierta · ${open.players.length} jugadores · turno ${open.turn} · ${minutes} min`
                  : "Vidas, daño de comandante y veneno a pantalla completa, de 2 a 6 jugadores."}
              </T>
            </View>
          </View>
          <Button
            label={open ? "Seguir la partida" : "Empezar partida"}
            icon={open ? "play" : "add"}
            onPress={() => router.push("/play")}
          />
          <Button
            label="Registrar una partida jugada"
            kind="ghost"
            icon="trophy-outline"
            onPress={() => setRecord(true)}
          />
        </Card>
      </View>

      <SectionTitle
        right={
          myGroups.length > 0 ? (
            <T
              variant="small"
              style={{ color: colors.accent }}
              onPress={() => router.push("/groups")}
            >
              Ver todos
            </T>
          ) : undefined
        }
      >
        Tus grupos
      </SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {myGroups.length === 0 ? (
          <Pressable
            onPress={() => router.push("/groups")}
            style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.hover }]}
          >
            <Ionicons name="people-outline" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <T>Crea un grupo o únete a uno</T>
              <T variant="small">Partidas, clasificación y quién tiene cada carta en tu mesa.</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text3} />
          </Pressable>
        ) : (
          myGroups.slice(0, 3).map((g) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(`/groups/${g.id}`)}
              style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.hover }]}
            >
              <Ionicons name="people" size={20} color={colors.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <T numberOfLines={1} style={{ fontWeight: "600" }}>
                  {g.name}
                </T>
                <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                  <Meta icon="person-outline" text={`${g.members}`} />
                  <Meta icon="trophy-outline" text={`${g.games} partidas`} />
                  {g.lastGameAt && (
                    <Meta icon="time-outline" text={`última ${playedOn(g.lastGameAt)}`} />
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Pressable>
          ))
        )}
      </View>

      <SectionTitle>Últimas partidas</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {recent.length === 0 ? (
          <T variant="muted">
            {games.isPending
              ? "Cargando…"
              : "Aún no hay partidas. Al acabar una en el contador, regístrala para la clasificación."}
          </T>
        ) : (
          recent.map((g) => <GameCard key={g.id} game={g} />)
        )}
      </View>

      <RecordGameSheet
        open={record}
        onClose={() => setRecord(false)}
        onSaved={(id) => {
          setRecord(false);
          router.push(`/games/${id}`);
        }}
        me={profile.data?.username ?? null}
      />
    </ScrollView>
  );
}

const rowStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  padding: 14,
  backgroundColor: colors.panel,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.line,
};
