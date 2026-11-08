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
import { t } from "~/lib/i18n";

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
          title={t("Aún no tienes grupos", "You don't have any groups yet")}
          text={t(
            "Crea uno con tu mesa de juego para llevar las partidas, la clasificación y ver quién tiene cada carta. O entra en uno con su enlace de invitación.",
            "Create one with your playgroup to track games and standings and see who owns each card. Or join one with its invite link.",
          )}
          action={
            <View style={{ gap: 8, alignSelf: "stretch" }}>
              <Button
                label={t("Crear grupo", "Create group")}
                icon="add"
                onPress={() => setSheet("new")}
              />
              <Button
                label={t("Tengo un enlace de invitación", "I have an invite link")}
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
              label={t("Entrar con un enlace de invitación", "Join with an invite link")}
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
                <Meta icon="trophy-outline" text={`${item.games} ${t("partidas", "games")}`} />
                {item.lastGameAt && (
                  <Meta
                    icon="time-outline"
                    text={`${t("última", "last")} ${playedOn(item.lastGameAt)}`}
                  />
                )}
                {item.isOwner && (
                  <Meta icon="star-outline" text={t("Creador", "Creator")} color={colors.warn} />
                )}
              </View>
            </Pressable>
          )}
        />
      )}
      {list.length > 0 && (
        <Fab icon="add" label={t("Crear grupo", "Create group")} onPress={() => setSheet("new")} />
      )}

      <Sheet
        open={sheet === "new"}
        onClose={() => setSheet(null)}
        title={t("Nuevo grupo", "New group")}
        footer={
          <Button
            label={t("Crear grupo", "Create group")}
            busy={create.isPending}
            disabled={!name.trim()}
            onPress={() => create.mutate()}
          />
        }
      >
        {create.isError && <Banner text={create.error.message} />}
        <Field
          label={t("Nombre", "Name")}
          placeholder={t("Los del jueves", "Thursday crew")}
          value={name}
          maxLength={80}
          onChangeText={setName}
        />
        <Field
          label={t("Descripción (opcional)", "Description (optional)")}
          placeholder={t("Dónde y cuándo jugáis…", "Where and when you play…")}
          value={description}
          maxLength={300}
          onChangeText={setDescription}
        />
      </Sheet>
      <Sheet
        open={sheet === "join"}
        onClose={() => setSheet(null)}
        title={t("Entrar en un grupo", "Join a group")}
        footer={
          <Button
            label={t("Ver el grupo", "See the group")}
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
          label={t("Enlace de invitación", "Invite link")}
          placeholder="https://doctordeck.app/groups/join/…"
          value={invite}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setInvite}
        />
        <T variant="small">
          {t(
            "Pídeselo a quien creó el grupo (está en la pestaña Miembros).",
            "Ask whoever created the group (it's in the Members tab).",
          )}
        </T>
      </Sheet>
    </View>
  );
}
