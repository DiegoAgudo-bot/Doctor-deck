import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import type { CardDTO, MyProfileDTO } from "@/server/dto";
import type { GroupCardDTO, GroupDTO, GroupDeckDTO } from "@/server/social-dto";
import { CardThumb } from "~/components/card-bits";
import { DeckTile } from "~/components/deck-tile";
import { CardPicker, GameCard, playedOn, StandingsBlock } from "~/components/games";
import { LendSheet } from "~/components/lend";
import { RecordGameSheet } from "~/components/record-game";
import { Sheet } from "~/components/sheet";
import { Card, PersonRow, SectionTitle } from "~/components/social";
import { toast } from "~/components/toast";
import {
  Banner,
  Button,
  ErrorView,
  Field,
  IconButton,
  Loading,
  Segmented,
  T,
} from "~/components/ui";
import { api } from "~/lib/api";
import { API_URL } from "~/lib/config";
import { colors, radius } from "~/lib/theme";

type Tab = "games" | "members" | "decks" | "cards";

/** Un grupo (solo sus miembros): partidas y clasificación, miembros, mazos y quién tiene qué. */
export default function GroupScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(
    (["games", "members", "decks", "cards"] as const).find((t) => t === initialTab) ?? "games",
  );
  const [record, setRecord] = useState(false);
  const [editing, setEditing] = useState(false);
  const group = useQuery({
    queryKey: ["group", id],
    queryFn: () => api<GroupDTO>(`/api/groups/${id}`),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<MyProfileDTO>("/api/me/profile") });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<GroupDTO>(`/api/groups/${id}`, { method: "PATCH", body }),
    onSuccess: (g) => {
      qc.setQueryData(["group", id], g);
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast(e.message),
  });

  if (group.isPending) return <Loading />;
  if (group.isError || !group.data)
    return <ErrorView error={group.error} onRetry={() => group.refetch()} />;
  const g = group.data;
  const invite = `${API_URL}/groups/join/${g.inviteCode}`;

  const removeMember = (username: string, isMe: boolean) =>
    Alert.alert(
      isMe ? "¿Salir del grupo?" : `¿Quitar a @${username}?`,
      isMe ? "Para volver necesitarás otra vez el enlace de invitación." : "",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: isMe ? "Salir" : "Quitar",
          style: "destructive",
          onPress: () =>
            api(`/api/groups/${id}/members/${username}`, { method: "DELETE" })
              .then(() => {
                qc.invalidateQueries({ queryKey: ["groups"] });
                if (isMe) router.back();
                else group.refetch();
              })
              .catch((e: Error) => toast(e.message)),
        },
      ],
    );
  const deleteGroup = () =>
    Alert.alert(
      "¿Borrar el grupo?",
      `Se borran el grupo y sus ${g.stats.games} partidas. Los mazos y colecciones de cada uno no se tocan.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar con sus partidas",
          style: "destructive",
          onPress: () =>
            api(`/api/groups/${id}`, { method: "DELETE" })
              .then(() => {
                qc.invalidateQueries({ queryKey: ["groups"] });
                router.back();
              })
              .catch((e: Error) => toast(e.message)),
        },
      ],
    );

  return (
    <>
      <Stack.Screen
        options={{
          title: g.name,
          headerRight: () => (
            <IconButton
              icon="person-add-outline"
              label="Invitar"
              onPress={() =>
                Share.share({ message: `Únete a «${g.name}» en Doctor Deck: ${invite}` })
              }
            />
          ),
        }}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {g.description ? <T variant="small">{g.description}</T> : null}
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "games", label: "Partidas" },
            { key: "cards", label: "Cartas" },
            { key: "decks", label: "Mazos" },
            { key: "members", label: `Miembros · ${g.members.length}` },
          ]}
        />
      </View>

      {tab === "games" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={group.isRefetching}
              onRefresh={() => group.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <Button label="Registrar partida" icon="trophy-outline" onPress={() => setRecord(true)} />
          <Card>
            <T variant="h2">Clasificación</T>
            <StandingsBlock
              players={g.stats.players}
              decks={g.stats.decks}
              empty="Aún no hay partidas. Registra la primera desde aquí o desde el contador de vidas."
            />
          </Card>
          <T variant="label">Últimas partidas</T>
          {g.stats.recent.length === 0 ? (
            <T variant="muted">Sin partidas.</T>
          ) : (
            g.stats.recent.map((game) => <GameCard key={game.id} game={game} showGroup={false} />)
          )}
        </ScrollView>
      )}

      {tab === "cards" && <GroupCards groupId={id} me={me.data?.username ?? null} />}
      {tab === "decks" && <GroupDecks groupId={id} />}

      {tab === "members" && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ padding: 16, gap: 8 }}>
            <Card>
              <T variant="label">Enlace de invitación</T>
              <T variant="mono" selectable>
                {invite}
              </T>
              <T variant="small">
                Quien lo abra puede entrar en el grupo.
                {g.isOwner &&
                  " Si se ha compartido de más, genera uno nuevo y el anterior deja de valer."}
              </T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  label="Compartir"
                  icon="share-social-outline"
                  style={{ flex: 1 }}
                  onPress={() =>
                    Share.share({ message: `Únete a «${g.name}» en Doctor Deck: ${invite}` })
                  }
                />
                {g.isOwner && (
                  <Button
                    label="Nuevo enlace"
                    kind="secondary"
                    icon="refresh"
                    style={{ flex: 1 }}
                    busy={patch.isPending && patch.variables?.newInvite === true}
                    onPress={() => patch.mutate({ newInvite: true })}
                  />
                )}
              </View>
            </Card>
          </View>
          {g.members.map((m) => (
            <PersonRow
              key={m.username ?? m.name}
              person={m}
              detail={`desde ${playedOn(m.joinedAt)}`}
              right={
                m.isOwner ? (
                  <T variant="small" style={{ color: colors.warn }}>
                    Creador
                  </T>
                ) : (m.isMe || g.isOwner) && m.username ? (
                  <Button
                    label={m.isMe ? "Salir" : "Quitar"}
                    kind="ghost"
                    onPress={() => removeMember(m.username!, m.isMe)}
                  />
                ) : undefined
              }
            />
          ))}
          {g.isOwner && (
            <View style={{ padding: 16, gap: 8 }}>
              <Button
                label="Cambiar nombre"
                kind="secondary"
                icon="create-outline"
                onPress={() => setEditing(true)}
              />
              <Button
                label="Borrar el grupo"
                kind="danger"
                icon="trash-outline"
                onPress={deleteGroup}
              />
            </View>
          )}
        </ScrollView>
      )}

      <RecordGameSheet
        open={record}
        onClose={() => setRecord(false)}
        groupId={id}
        me={me.data?.username ?? null}
        onSaved={() => {
          setRecord(false);
          setTab("games");
          group.refetch();
        }}
      />
      <EditGroupSheet
        open={editing}
        group={g}
        onClose={() => setEditing(false)}
        onSave={(name, description) => {
          setEditing(false);
          patch.mutate({ name, description });
        }}
      />
    </>
  );
}

function EditGroupSheet({
  open,
  group,
  onClose,
  onSave,
}: {
  open: boolean;
  group: GroupDTO;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cambiar nombre"
      footer={
        <Button
          label="Guardar"
          disabled={!name.trim()}
          onPress={() => onSave(name.trim(), description.trim())}
        />
      }
    >
      <Field label="Nombre" value={name} maxLength={80} onChangeText={setName} />
      <Field
        label="Descripción"
        value={description}
        maxLength={300}
        onChangeText={setDescription}
      />
    </Sheet>
  );
}

function GroupDecks({ groupId }: { groupId: string }) {
  const decks = useQuery({
    queryKey: ["group-decks", groupId],
    queryFn: () => api<GroupDeckDTO[]>(`/api/groups/${groupId}/decks`),
  });
  if (decks.isPending) return <Loading />;
  if (decks.isError) return <ErrorView error={decks.error} onRetry={() => decks.refetch()} />;
  if (decks.data.length === 0)
    return (
      <View style={{ padding: 16 }}>
        <T variant="muted">Nadie del grupo tiene mazos públicos u ocultos todavía.</T>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {decks.data.map((d) => (
        <DeckTile key={d.id} deck={d} owner={d.owner.username ?? d.owner.name} />
      ))}
    </ScrollView>
  );
}

/** Quién tiene cada carta: buscar una y lo que me falta que alguien del grupo tiene libre. */
function GroupCards({ groupId, me }: { groupId: string; me: string | null }) {
  const [picked, setPicked] = useState<CardDTO | null>(null);
  const [lend, setLend] = useState<CardDTO | null>(null);
  const canLend = useQuery({
    queryKey: ["group-can-lend", groupId],
    queryFn: () => api<GroupCardDTO[]>(`/api/groups/${groupId}/can-lend`),
  });
  const found = useQuery({
    queryKey: ["group-card", groupId, picked?.oracleId],
    queryFn: () =>
      api<GroupCardDTO>(
        `/api/groups/${groupId}/cards?oracleId=${encodeURIComponent(picked!.oracleId)}`,
      ),
    enabled: picked !== null,
  });

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <CardPicker label="¿Quién del grupo tiene…?" onPick={setPicked} />
        {picked &&
          (found.isPending ? (
            <Loading />
          ) : found.isError ? (
            <Banner text={found.error.message} />
          ) : (
            <HolderCard row={found.data} me={me} onLend={setLend} />
          ))}
      </Card>
      <SectionTitle style={{ paddingHorizontal: 0 }}>Te lo pueden dejar</SectionTitle>
      <T variant="small">
        Lo que te falta para tus mazos (o está en tu lista de deseos) y alguien del grupo tiene
        libre: pídeselo prestado.
      </T>
      {canLend.isPending ? (
        <Loading label="Cruzando las colecciones del grupo…" />
      ) : canLend.isError ? (
        <Banner text={canLend.error.message} />
      ) : canLend.data.length === 0 ? (
        <T variant="muted">Nadie del grupo tiene libre lo que te falta.</T>
      ) : (
        canLend.data.map((r) => <HolderCard key={r.card.oracleId} row={r} me={me} />)
      )}
      <LendSheet card={lend} open={lend !== null} onClose={() => setLend(null)} />
    </ScrollView>
  );
}

function HolderCard({
  row,
  me,
  onLend,
}: {
  row: GroupCardDTO;
  me: string | null;
  onLend?: (card: CardDTO) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Pressable onPress={() => router.push(`/card/${row.card.oracleId}`)}>
        <CardThumb uri={row.card.imageUrl} width={56} name={row.card.name} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <T style={{ fontWeight: "700" }} numberOfLines={1}>
          {row.card.name}
        </T>
        {row.wanted > 0 && (
          <T variant="small">
            Te {row.wanted === 1 ? "falta 1 copia" : `faltan ${row.wanted} copias`}
          </T>
        )}
        {row.holders.length === 0 ? (
          <T variant="muted">Nadie del grupo la tiene.</T>
        ) : (
          row.holders.map((h) => (
            <View
              key={h.member.username ?? h.member.name}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <T
                variant="small"
                style={{ color: colors.accent }}
                onPress={
                  h.member.username ? () => router.push(`/u/${h.member.username}`) : undefined
                }
              >
                {h.member.username ? `@${h.member.username}` : h.member.name}
              </T>
              <T variant="mono">
                {h.free}/{h.owned} libres
              </T>
              {h.usedIn.length > 0 && (
                <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
                  en {h.usedIn.join(", ")}
                </T>
              )}
              {onLend && h.member.username === me && h.free > 0 && (
                <T
                  variant="small"
                  style={{ color: colors.accent, fontWeight: "700", marginLeft: "auto" }}
                  onPress={() => onLend(row.card)}
                >
                  Prestar
                </T>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
