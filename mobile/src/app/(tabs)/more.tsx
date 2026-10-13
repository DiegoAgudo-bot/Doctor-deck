import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, View } from "react-native";
import type { MyProfileDTO } from "@/server/dto";
import { MenuRow, T, type IconName } from "~/components/ui";
import { api } from "~/lib/api";
import { authClient, useSession } from "~/lib/auth";
import { API_URL, APP_VERSION } from "~/lib/config";
import { unregisterPush } from "~/lib/push";
import { clearCache } from "~/lib/query";
import { colors } from "~/lib/theme";

const web = (path: string, title: string) =>
  router.push(`/web?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`);

const SECTIONS: {
  title: string;
  items: { icon: IconName; label: string; detail?: string; path: string }[];
}[] = [
  {
    title: "Jugar",
    items: [
      {
        icon: "heart-outline",
        label: "Contador de vidas",
        detail: "A pantalla completa, de 2 a 6 jugadores",
        path: "/play",
      },
      {
        icon: "people-outline",
        label: "Grupos de juego",
        detail: "Partidas, clasificación y quién tiene qué",
        path: "/groups",
      },
    ],
  },
  {
    title: "Cartas entre amigos",
    items: [
      {
        icon: "swap-horizontal-outline",
        label: "Intercambios",
        detail: "Cruces, lista de deseos y propuestas",
        path: "/trades",
      },
      { icon: "hand-left-outline", label: "Préstamos", path: "/loans" },
    ],
  },
  {
    title: "Comunidad",
    items: [
      {
        icon: "globe-outline",
        label: "Mazos de la comunidad",
        detail: "Los que puedes montar con tu colección",
        path: "/community",
      },
      { icon: "newspaper-outline", label: "Actividad", path: "/feed" },
    ],
  },
];

/** Todo lo demás (como el menú "Más" de ManaBox): perfil, secciones de la web y ajustes. */
export default function More() {
  const { data: session } = useSession();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MyProfileDTO>("/api/me/profile"),
  });

  const signOut = () =>
    Alert.alert("¿Cerrar sesión?", "", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await unregisterPush();
          await authClient.signOut();
          await clearCache();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ padding: 16, gap: 2 }}>
        <T variant="title">{session?.user.name}</T>
        <T variant="small">
          {profile.data?.username ? `@${profile.data.username} · ` : ""}
          {session?.user.email}
        </T>
      </View>
      {profile.data?.username && (
        <MenuRow
          icon="person-circle-outline"
          label="Mi perfil público"
          onPress={() => web(`/u/${profile.data.username}`, "Perfil")}
        />
      )}
      {SECTIONS.map((s) => (
        <View key={s.title}>
          <T variant="label" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
            {s.title}
          </T>
          {s.items.map((i) => (
            <MenuRow
              key={i.path}
              icon={i.icon}
              label={i.label}
              detail={i.detail}
              onPress={() => web(i.path, i.label)}
            />
          ))}
        </View>
      ))}
      <T variant="label" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
        Cuenta
      </T>
      <MenuRow
        icon="settings-outline"
        label="Ajustes"
        detail="Perfil, avisos de precio, privacidad, vincular Google"
        onPress={() => web("/settings", "Ajustes")}
      />
      <MenuRow
        icon="document-text-outline"
        label="Privacidad"
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
      />
      <MenuRow icon="log-out-outline" label="Cerrar sesión" onPress={signOut} danger />
      <T variant="small" style={{ textAlign: "center", marginTop: 24, color: colors.text3 }}>
        Doctor Deck {APP_VERSION} · Contenido no oficial permitido por la Fan Content Policy de
        Wizards of the Coast.
      </T>
    </ScrollView>
  );
}
