import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import type { GroupSummaryDTO } from "@/server/social-dto";
import { playedOn } from "~/components/games";
import { Sheet } from "~/components/sheet";
import { Meta } from "~/components/social";
import { Banner, Button, Empty, ErrorView, Fab, Field, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { inviteCodeFrom } from "~/lib/paths";
import { colors, radius } from "~/lib/theme";

/** Mis grupos de juego: crear uno o entrar con un enlace de invitación. */
export default function Groups() {
  const qc = useQueryClient();
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<GroupSummaryDTO[]>("/api/groups"),
  });
  const [sheet, setSheet] = useState<"new" | "join" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invite, setInvite] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/groups", {
        body: { name: name.trim(), ...(description.trim() ? { description } : {}) },
      }),
    onSuccess: ({ id }) => {
      setSheet(null);
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["groups"] });
      router.push(`/groups/${id}`);
    },
  });
  const code = inviteCodeFrom(invite);

  const list = groups.data ?? [];
  return (
    <View style={{ flex: 1 }}>
      {groups.isPending ? (
        <Loading />
      ) : groups.isError && !groups.data ? (
        <ErrorView error={groups.error} onRetry={() => groups.refetch()} />
      ) : list.length === 0 ? (
        <Empty
          icon="people-outline"
          title="Aún no tienes grupos"
          text="Crea uno con tu mesa de juego para llevar las partidas, la clasificación y ver quién tiene cada carta. O entra en uno con su enlace de invitación."
          action={
            <View style={{ gap: 8, alignSelf: "stretch" }}>
              <Button label="Crear grupo" icon="add" onPress={() => setSheet("new")} />
              <Button
                label="Tengo un enlace de invitación"
                kind="secondary"
                icon="link-outline"
                onPress={() => setSheet("join")}
              />
            </View>
          }
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={groups.isRefetching}
              onRefresh={() => groups.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListFooterComponent={
            <Button
              label="Entrar con un enlace de invitación"
              kind="ghost"
              icon="link-outline"
              onPress={() => setSheet("join")}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/groups/${item.id}`)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.hover : colors.panel,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.line,
                padding: 14,
                gap: 6,
              })}
            >
              <T variant="h2" numberOfLines={1}>
                {item.name}
              </T>
              {item.description ? (
                <T variant="small" numberOfLines={2}>
                  {item.description}
                </T>
              ) : null}
              <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
                <Meta icon="people-outline" text={`${item.members}`} />
                <Meta icon="trophy-outline" text={`${item.games} partidas`} />
                {item.lastGameAt && (
                  <Meta icon="time-outline" text={`última ${playedOn(item.lastGameAt)}`} />
                )}
                {item.isOwner && <Meta icon="star-outline" text="Creador" color={colors.warn} />}
              </View>
            </Pressable>
          )}
        />
      )}
      {list.length > 0 && <Fab icon="add" label="Crear grupo" onPress={() => setSheet("new")} />}

      <Sheet
        open={sheet === "new"}
        onClose={() => setSheet(null)}
        title="Nuevo grupo"
        footer={
          <Button
            label="Crear grupo"
            busy={create.isPending}
            disabled={!name.trim()}
            onPress={() => create.mutate()}
          />
        }
      >
        {create.isError && <Banner text={create.error.message} />}
        <Field
          label="Nombre"
          placeholder="Los del jueves"
          value={name}
          maxLength={80}
          onChangeText={setName}
        />
        <Field
          label="Descripción (opcional)"
          placeholder="Dónde y cuándo jugáis…"
          value={description}
          maxLength={300}
          onChangeText={setDescription}
        />
      </Sheet>
      <Sheet
        open={sheet === "join"}
        onClose={() => setSheet(null)}
        title="Entrar en un grupo"
        footer={
          <Button
            label="Ver el grupo"
            disabled={!code}
            onPress={() => {
              setSheet(null);
              setInvite("");
              router.push(`/groups/join/${code}`);
            }}
          />
        }
      >
        <Field
          label="Enlace de invitación"
          placeholder="https://doctordeck.app/groups/join/…"
          value={invite}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setInvite}
        />
        <T variant="small">Pídeselo a quien creó el grupo (está en la pestaña Miembros).</T>
      </Sheet>
    </View>
  );
}
