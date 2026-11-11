import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { AccountButton } from "~/components/account-button";
import { Bell } from "~/components/bell";
import { GemHeaderBackground } from "~/components/gem-stripe";
import type { IconName } from "~/components/ui";
import { colors, displayFont } from "~/lib/theme";
import { t } from "~/lib/i18n";

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : name} size={size} color={color as string} />
  );

/**
 * Barra inferior con lo que más se usa: Inicio, Colección, Mazos, Buscar, Jugar y Escanear (abre la
 * cámara a pantalla completa). En la cabecera, la campana de avisos y el botón de la cuenta (la inicial),
 * que abre el menú con todo lo demás.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerBackground: () => <GemHeaderBackground />,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700", fontFamily: displayFont, fontSize: 21 },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ marginRight: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Bell />
            <AccountButton />
          </View>
        ),
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("Inicio", "Home"), tabBarIcon: icon("home-outline", "home") }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: t("Colección", "Collection"),
          tabBarIcon: icon("albums-outline", "albums"),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{ title: t("Mazos", "Decks"), tabBarIcon: icon("layers-outline", "layers") }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: t("Buscar", "Search"), tabBarIcon: icon("search-outline", "search") }}
      />
      <Tabs.Screen
        name="games"
        options={{ title: t("Jugar", "Play"), tabBarIcon: icon("dice-outline", "dice") }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ title: t("Escanear", "Scan"), tabBarIcon: icon("scan-outline", "scan") }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/scan");
          },
        }}
      />
    </Tabs>
  );
}
