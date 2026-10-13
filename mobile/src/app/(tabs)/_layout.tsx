import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import type { NotificationsResponse } from "@/server/dto";
import type { IconName } from "~/components/ui";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : name} size={size} color={color as string} />
  );

/** Barra inferior como la de ManaBox: Colección, Mazos, Buscar, Avisos y Más. */
export default function TabsLayout() {
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
  });
  const unread = notifications.data?.unread ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="collection"
        options={{ title: "Colección", tabBarIcon: icon("albums-outline", "albums") }}
      />
      <Tabs.Screen
        name="decks"
        options={{ title: "Mazos", tabBarIcon: icon("layers-outline", "layers") }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: "Buscar", tabBarIcon: icon("search-outline", "search") }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Avisos",
          tabBarIcon: icon("notifications-outline", "notifications"),
          ...(unread > 0 ? { tabBarBadge: unread > 99 ? "99+" : unread } : {}),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "Más", tabBarIcon: icon("menu-outline", "menu") }}
      />
    </Tabs>
  );
}
