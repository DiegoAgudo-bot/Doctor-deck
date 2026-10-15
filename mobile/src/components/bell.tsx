import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { NotificationsResponse } from "@/server/dto";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";

/** Avisos sin leer (se comparte con la pantalla de avisos; se refresca cada minuto). */
export function useUnread() {
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
  });
  return q.data?.unread ?? 0;
}

/** Campana de la cabecera (como en la web): abre los avisos, con los sin leer en rojo. */
export function Bell() {
  const unread = useUnread();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Avisos, ${unread} sin leer` : "Avisos"}
      hitSlop={10}
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons
        name={unread ? "notifications" : "notifications-outline"}
        size={22}
        color={colors.text}
      />
      {unread > 0 && (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: 0,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: colors.out,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.panel,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
