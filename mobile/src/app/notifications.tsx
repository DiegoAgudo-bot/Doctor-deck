import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import type { NotificationDTO, NotificationsResponse } from "@/server/dto";
import { Empty, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { ago } from "~/lib/format";
import { openWebPath } from "~/lib/push";
import { colors } from "~/lib/theme";

const ICONS: Partial<Record<NotificationDTO["type"], keyof typeof Ionicons.glyphMap>> = {
  price_drop: "trending-down-outline",
  new_deck: "layers-outline",
  big_card: "sparkles-outline",
  trade_match: "swap-horizontal-outline",
  trade_proposal: "swap-horizontal-outline",
  trade_counter: "swap-horizontal-outline",
  trade_accepted: "checkmark-circle-outline",
  trade_rejected: "close-circle-outline",
  trade_cancelled: "close-circle-outline",
  group_join: "people-outline",
  game_recorded: "trophy-outline",
  deck_comment: "chatbubble-outline",
  loan_new: "hand-left-outline",
};

/** Mis avisos (los mismos que llegan como notificación), desde la campana. Al abrirlos se marcan leídos. */
export default function Notifications() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResponse>("/api/notifications"),
  });

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        api("/api/notifications/read", { body: {} })
          .then(() =>
            qc.setQueryData<NotificationsResponse>(["notifications"], (old) =>
              old ? { ...old, unread: 0 } : old,
            ),
          )
          .catch(() => {});
      }, 1500);
      return () => clearTimeout(t);
    }, [qc]),
  );

  if (list.isPending) return <Loading />;
  if (list.isError && !list.data)
    return <ErrorView error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data?.items ?? [];
  if (items.length === 0) {
    return (
      <Empty
        icon="notifications-outline"
        title="Sin avisos"
        text="Aquí verás bajadas de precio, propuestas de intercambio, comentarios y lo que publica la gente a la que sigues."
      />
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => list.refetch()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openWebPath(item.message.path)}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: 12,
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            backgroundColor: pressed ? colors.hover : item.read ? "transparent" : colors.raised,
          })}
        >
          <Ionicons
            name={ICONS[item.type] ?? "notifications-outline"}
            size={20}
            color={colors.accent}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="small" style={{ fontWeight: "600", color: colors.text2 }}>
              {item.message.title}
            </T>
            <T>{item.message.body}</T>
          </View>
          <T variant="small">{ago(item.createdAt)}</T>
        </Pressable>
      )}
    />
  );
}
