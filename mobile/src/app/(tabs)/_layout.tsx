import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { Bell } from "~/components/bell";
import type { IconName } from "~/components/ui";
import { colors } from "~/lib/theme";

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : name} size={size} color={color as string} />
  );

/**
 * Barra inferior con lo que más se usa: Colección, Mazos, Buscar, Jugar y Más. Los avisos van en
 * la campana de la cabecera (como en la web).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ marginRight: 10 }}>
            <Bell />
          </View>
        ),
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
        name="games"
        options={{ title: "Jugar", tabBarIcon: icon("dice-outline", "dice") }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "Más", tabBarIcon: icon("menu-outline", "menu") }}
      />
    </Tabs>
  );
}
