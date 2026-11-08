import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState, type ReactElement } from "react";
import { FlatList, Pressable, ScrollView, Share, View } from "react-native";
import type {
  CollectionViewResponse,
  CommunityResponse,
  ProfileViewDTO,
  TradePartnerDTO,
} from "@/server/dto";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { CommunityDeck } from "~/components/community-deck";
import { DeckTile } from "~/components/deck-tile";
import { Avatar, Stat } from "~/components/social";
import { toast } from "~/components/toast";
import { PartnerCard } from "~/components/trades";
import {
  Banner,
  Button,
  Empty,
  ErrorView,
  IconButton,
  Loading,
  SearchField,
  Segmented,
  T,
} from "~/components/ui";
import { api } from "~/lib/api";
import { API_URL } from "~/lib/config";
import { tapFeedback } from "~/lib/feedback";
import { euros, thousands } from "~/lib/format";
import { useDebounced } from "~/lib/hooks";
import { colors } from "~/lib/theme";
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

/** Perfil público: seguir, bloquear, sus mazos (con cuánto tengo), su colección y el cruce. */
export default function Profile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"decks" | "collection">("decks");
  const view = useQuery({
    queryKey: ["user", username],
    queryFn: () => api<ProfileViewDTO>(`/api/users/${encodeURIComponent(username)}`),
  });
  const v = view.data;
  const isMe = v?.isMe ?? true;
  const extra = useQuery({
    queryKey: ["community", { username }],
    enabled: Boolean(v) && !isMe,
    queryFn: () =>
      api<CommunityResponse>("/api/community/decks", {
        body: { filters: { username }, limit: 100 },
      }),
  });
  const trade = useQuery({
    queryKey: ["trade-match", username],
    enabled: Boolean(v) && !isMe && Boolean(v?.profile.tradesPublic) && !v?.blocked,
    queryFn: () =>
      api<TradePartnerDTO[]>(`/api/trades/matches?username=${encodeURIComponent(username)}`),
  });

  const follow = useMutation({
    mutationFn: (on: boolean) =>
      api<{ isFollowing: boolean; followers: number }>(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: on ? "POST" : "DELETE" },
      ),
    onSuccess: (r) => {
      tapFeedback();
      qc.setQueryData<ProfileViewDTO>(["user", username], (old) =>
        old ? { ...old, isFollowing: r.isFollowing, followers: r.followers } : old,
      );
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e) => toast(e.message),
  });
  const block = useMutation({
    mutationFn: (on: boolean) =>
      api(`/api/users/${encodeURIComponent(username)}/block`, { method: on ? "POST" : "DELETE" }),
    onSuccess: (_r, on) => {
      toast(on ? `Has bloqueado a @${username}` : `Has desbloqueado a @${username}`);
      view.refetch();
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
    onError: (e) => toast(e.message),
  });

  if (view.isPending) return <Loading />;
  if (view.isError || !v) return <ErrorView error={view.error} onRetry={() => view.refetch()} />;
  const p = v.profile;
  const byId = new Map((extra.data?.items ?? []).map((d) => [d.id, d]));
  const canSeeCollection = p.collectionPublic || v.isMe;

  const confirmBlock = () =>
    alert(
      t(`¿Bloquear a @${p.username}?`, `Block @${p.username}?`),
      t(
        "Dejaréis de seguiros, no podrá comentar tus mazos ni proponerte intercambios ni préstamos, y no verás sus comentarios ni su actividad. No se le avisa.",
        "You'll stop following each other, they won't be able to comment on your decks or propose trades or loans, and you won't see their comments or activity. They aren't notified.",
      ),
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        { text: t("Bloquear", "Block"), style: "destructive", onPress: () => block.mutate(true) },
      ],
    );

  const head = (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={p.name || p.username} image={p.image} size={60} />
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={1}>
            {p.name || `@${p.username}`}
          </T>
          <T variant="small">@{p.username}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <Stat label={t("mazos", "decks")} value={thousands(v.decks.length)} />
        <Stat label={t("seguidores", "followers")} value={thousands(v.followers)} />
        <Stat label={t("siguiendo", "following")} value={thousands(v.following)} />
        <Stat
          label={t("partidas ganadas", "games won")}
          value={`${v.record.wins}/${v.record.games}`}
        />
      </View>
      {!v.isMe && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!v.blocked && (
            <Button
              label={v.isFollowing ? t("Siguiendo", "Following") : t("Seguir", "Follow")}
              icon={v.isFollowing ? "checkmark" : "person-add-outline"}
              kind={v.isFollowing ? "secondary" : "primary"}
              style={{ flex: 1 }}
              busy={follow.isPending}
              onPress={() => follow.mutate(!v.isFollowing)}
            />
          )}
          {!v.blocked && p.tradesPublic && (
            <Button
              label={t("Intercambio", "Trade")}
              icon="swap-horizontal-outline"
              kind="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push(`/trades/with/${p.username}`)}
            />
          )}
        </View>
      )}
      {v.isMe && (
        <Button
          label={t("Editar perfil", "Edit profile")}
          kind="secondary"
          icon="settings-outline"
          onPress={() => router.push("/settings")}
        />
      )}
      {v.blocked && (
        <Banner
          text={t(
            `Has bloqueado a @${p.username}: no puede seguirte, comentar tus mazos ni proponerte intercambios, y no ves su actividad.`,
            `You've blocked @${p.username}: they can't follow you, comment on your decks or propose trades, and you don't see their activity.`,
          )}
        />
      )}
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: "decks", label: t(`Mazos · ${v.decks.length}`, `Decks · ${v.decks.length}`) },
          {
            key: "collection",
            label: p.collectionPublic
              ? t("Colección", "Collection")
              : t("Colección (privada)", "Collection (private)"),
          },
        ]}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: `@${p.username}`,
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <IconButton
                icon="share-social-outline"
                label={t("Compartir perfil", "Share profile")}
                onPress={() =>
                  Share.share({
                    message: `@${p.username} en Doctor Deck: ${API_URL}/u/${p.username}`,
                  })
                }
              />
              {!v.isMe && (
                <IconButton
                  icon={v.blocked ? "lock-open-outline" : "ban-outline"}
                  label={v.blocked ? t("Desbloquear", "Unblock") : t("Bloquear", "Block")}
                  onPress={() => (v.blocked ? block.mutate(false) : confirmBlock())}
                />
              )}
            </View>
          ),
        }}
      />
      {tab === "decks" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {head}
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {v.decks.length === 0 ? (
              <T variant="muted">
                {v.isMe
                  ? t("Aún no has guardado ningún mazo.", "You haven't saved any decks yet.")
                  : t("Todavía no tiene mazos públicos.", "No public decks yet.")}
              </T>
            ) : (
              v.decks.map((d) => {
                const c = byId.get(d.id);
                return c ? <CommunityDeck key={d.id} deck={c} /> : <DeckTile key={d.id} deck={d} />;
              })
            )}
            {trade.data && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <T variant="h2">
                  {t("Intercambio con", "Trade with")} @{p.username}
                </T>
                {trade.data[0] ? (
                  <PartnerCard p={trade.data[0]} />
                ) : (
                  <T variant="muted">
                    {t(
                      "No tiene libre nada de tu lista de deseos ni busca nada de lo que te sobra. Puedes proponerle un intercambio a mano.",
                      "They have nothing spare from your wishlist and want nothing you can spare. You can propose a trade by hand.",
                    )}
                  </T>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      ) : canSeeCollection ? (
        <PublicCollection
          username={p.username}
          header={head}
          isMe={v.isMe}
          isPublic={p.collectionPublic}
        />
      ) : (
        <ScrollView>
          {head}
          <Empty
            icon="eye-off-outline"
            title={t("Colección privada", "Private collection")}
            text={`@${p.username} no enseña su colección.`}
          />
        </ScrollView>
      )}
    </>
  );
}

const PAGE = 48;

/** La colección de alguien (si es pública), por carta y de más a menos valor. */
function PublicCollection({
  username,
  header,
  isMe,
  isPublic,
}: {
  username: string;
  header: ReactElement;
  isMe: boolean;
  isPublic: boolean;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const list = useInfiniteQuery({
    queryKey: ["public-collection", username, query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<CollectionViewResponse>("/api/collection/view", {
        body: {
          username,
          filters: query ? { q: query } : {},
          sort: "valor",
          dir: "desc",
          offset: pageParam,
          limit: PAGE,
        },
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((s, p) => s + p.items.length, 0);
      return loaded < last.total.cards ? loaded : undefined;
    },
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const overall = list.data?.pages[0]?.overall;
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View>
          {header}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            {isMe && !isPublic && (
              <Banner
                tone="info"
                text={t(
                  "Tu colección es privada: solo la ves tú. Cámbialo en Ajustes.",
                  "Your collection is private: only you can see it. Change it in Settings.",
                )}
              />
            )}
            {overall && (
              <T variant="small">
                {thousands(overall.cards)} {t("cartas", "cards")} · {thousands(overall.copies)}{" "}
                {t("copias", "copies")} · {euros(overall.value)}
              </T>
            )}
            <SearchField
              placeholder={t("Buscar en su colección", "Search their collection")}
              value={q}
              onChangeText={setQ}
              onClear={() => setQ("")}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/card/${item.card.oracleId}`)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: pressed ? colors.hover : "transparent",
          })}
        >
          <CardThumb uri={item.card.imageUrl} width={34} name={item.card.name} />
          <View style={{ flex: 1 }}>
            <T numberOfLines={1}>{item.card.name}</T>
            <T variant="small" numberOfLines={1}>
              {item.card.typeLine}
            </T>
          </View>
          {item.foilQuantity > 0 && <FoilMark />}
          <T style={{ fontWeight: "700" }}>×{item.quantity}</T>
        </Pressable>
      )}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorView error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <T variant="muted" style={{ padding: 16 }}>
            {query
              ? t("Nada con ese nombre.", "Nothing with that name.")
              : t("Su colección está vacía.", "Their collection is empty.")}
          </T>
        )
      }
      ListFooterComponent={list.isFetchingNextPage ? <Loading /> : null}
    />
  );
}
