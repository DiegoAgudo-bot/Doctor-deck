import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
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
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

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
    alert(
      isMe
        ? t("¿Salir del grupo?", "Leave the group?")
        : t(`¿Quitar a @${username}?`, `Remove @${username}?`),
      isMe
        ? t(
            "Para volver necesitarás otra vez el enlace de invitación.",
            "To come back you'll need the invite link again.",
          )
        : "",
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        {
          text: isMe ? t("Salir", "Leave") : t("Quitar", "Remove"),
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
    alert(
      t("¿Borrar el grupo?", "Delete the group?"),
      t(
        `Se borran el grupo y sus ${g.stats.games} partidas. Los mazos y colecciones de cada uno no se tocan.`,
        `The group and its ${g.stats.games} games are deleted. Everyone's decks and collections aren't touched.`,
      ),
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        {
          text: t("Borrar con sus partidas", "Delete with its games"),
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
              label={t("Invitar", "Invite")}
              onPress={() =>
                Share.share({
                  message: t(
                    `Únete a «${g.name}» en Doctor Deck: ${invite}`,
                    `Join “${g.name}” on Doctor Deck: ${invite}`,
                  ),
                })
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
            { key: "games", label: t("Partidas", "Games") },
            { key: "cards", label: t("Cartas", "Cards") },
            { key: "decks", label: t("Mazos", "Decks") },
            { key: "members", label: `${t("Miembros", "Members")} · ${g.members.length}` },
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
          <Button
            label={t("Registrar partida", "Record game")}
            icon="trophy-outline"
            onPress={() => setRecord(true)}
          />
          <Card>
            <T variant="h2">{t("Clasificación", "Standings")}</T>
            <StandingsBlock
              players={g.stats.players}
              decks={g.stats.decks}
              empty={t(
                "Aún no hay partidas. Registra la primera desde aquí o desde el contador de vidas.",
                "No games yet. Record the first one from here or from the life counter.",
              )}
            />
          </Card>
          <T variant="label">{t("Últimas partidas", "Latest games")}</T>
          {g.stats.recent.length === 0 ? (
            <T variant="muted">{t("Sin partidas.", "No games.")}</T>
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
              <T variant="label">{t("Enlace de invitación", "Invite link")}</T>
              <T variant="mono" selectable>
                {invite}
              </T>
              <T variant="small">
                {t(
                  "Quien lo abra puede entrar en el grupo.",
                  "Anyone who opens it can join the group.",
                )}
                {g.isOwner &&
                  t(
                    " Si se ha compartido de más, genera uno nuevo y el anterior deja de valer.",
                    " If it's been shared too widely, create a new one and the old one stops working.",
                  )}
              </T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  label={t("Compartir", "Share")}
                  icon="share-social-outline"
                  style={{ flex: 1 }}
                  onPress={() =>
                    Share.share({
                      message: t(
                        `Únete a «${g.name}» en Doctor Deck: ${invite}`,
                        `Join “${g.name}” on Doctor Deck: ${invite}`,
                      ),
                    })
                  }
                />
                {g.isOwner && (
                  <Button
                    label={t("Nuevo enlace", "New link")}
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
              detail={`${t("desde", "since")} ${playedOn(m.joinedAt)}`}
              right={
                m.isOwner ? (
                  <T variant="small" style={{ color: colors.warn }}>
                    {t("Creador", "Creator")}
                  </T>
                ) : (m.isMe || g.isOwner) && m.username ? (
                  <Button
                    label={m.isMe ? t("Salir", "Leave") : t("Quitar", "Remove")}
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
                label={t("Cambiar nombre", "Rename")}
                kind="secondary"
                icon="create-outline"
                onPress={() => setEditing(true)}
              />
              <Button
                label={t("Borrar el grupo", "Delete the group")}
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
      title={t("Cambiar nombre", "Rename")}
      footer={
        <Button
          label={t("Guardar", "Save")}
          disabled={!name.trim()}
          onPress={() => onSave(name.trim(), description.trim())}
        />
      }
    >
      <Field label={t("Nombre", "Name")} value={name} maxLength={80} onChangeText={setName} />
      <Field
        label={t("Descripción", "Description")}
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
        <T variant="muted">
          {t(
            "Nadie del grupo tiene mazos públicos u ocultos todavía.",
            "Nobody in the group has public or unlisted decks yet.",
          )}
        </T>
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
        <CardPicker
          label={t("¿Quién del grupo tiene…?", "Who in the group has…?")}
          onPick={setPicked}
        />
        {picked &&
          (found.isPending ? (
            <Loading />
          ) : found.isError ? (
            <Banner text={found.error.message} />
          ) : (
            <HolderCard row={found.data} me={me} onLend={setLend} />
          ))}
      </Card>
      <SectionTitle style={{ paddingHorizontal: 0 }}>
        {t("Te lo pueden dejar", "They can lend you")}
      </SectionTitle>
      <T variant="small">
        {t(
          "Lo que te falta para tus mazos (o está en tu lista de deseos) y alguien del grupo tiene libre: pídeselo prestado.",
          "What you're missing for your decks (or is on your wishlist) and someone in the group has spare: ask to borrow it.",
        )}
      </T>
      {canLend.isPending ? (
        <Loading
          label={t("Cruzando las colecciones del grupo…", "Matching the group's collections…")}
        />
      ) : canLend.isError ? (
        <Banner text={canLend.error.message} />
      ) : canLend.data.length === 0 ? (
        <T variant="muted">
          {t(
            "Nadie del grupo tiene libre lo que te falta.",
            "Nobody in the group has what you're missing spare.",
          )}
        </T>
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
            {row.wanted === 1
              ? t("Te falta 1 copia", "You're missing 1 copy")
              : t(`Te faltan ${row.wanted} copias`, `You're missing ${row.wanted} copies`)}
          </T>
        )}
        {row.holders.length === 0 ? (
          <T variant="muted">{t("Nadie del grupo la tiene.", "Nobody in the group has it.")}</T>
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
                {h.free}/{h.owned} {t("libres", "spare")}
              </T>
              {h.usedIn.length > 0 && (
                <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
                  {t("en", "in")} {h.usedIn.join(", ")}
                </T>
              )}
              {onLend && h.member.username === me && h.free > 0 && (
                <T
                  variant="small"
                  style={{ color: colors.accent, fontWeight: "700", marginLeft: "auto" }}
                  onPress={() => onLend(row.card)}
                >
                  {t("Prestar", "Lend")}
                </T>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
