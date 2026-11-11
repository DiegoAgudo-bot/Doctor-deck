import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
  router,
  usePathname,
  type ErrorBoundaryProps,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, Linking, View } from "react-native";
import type { AppInfoDTO } from "@/server/dto";
import { DialogHost } from "~/components/dialog";
import { ToastHost } from "~/components/toast";
import { Button, Empty, Loading } from "~/components/ui";
import { api } from "~/lib/api";
import { useSession } from "~/lib/auth";
import { API_URL, APP_VERSION } from "~/lib/config";
import { isOlder } from "~/lib/format";
import { openWebPath, registerForPush, useNotificationTaps } from "~/lib/push";
import { persister, queryClient } from "~/lib/query";
import { pollNativeShare, useShareInbox } from "~/lib/share-intake";
import { colors, isLight } from "~/lib/theme";
import { t } from "~/lib/i18n";

const baseTheme = isLight ? DefaultTheme : DarkTheme;
const navTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    background: colors.bg,
    card: colors.panel,
    border: colors.line,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60_000, buster: APP_VERSION }}
    >
      <ThemeProvider value={navTheme}>
        <StatusBar style={isLight ? "dark" : "light"} />
        <Root />
        <ToastHost />
        <DialogHost />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Si algo falla al pintar, se enseña el error en vez de dejar la pantalla en negro (en Android, un
 * error sin capturar tira el motor de la app hasta forzar su cierre) y se manda al registro.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`${API_URL}/api/errors`, {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: `[app ${APP_VERSION}] ${error.message || String(error)}`,
        stack: error.stack ?? null,
        path: "app",
      }),
    }).catch(() => {});
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Empty
        icon="warning-outline"
        title={t("Algo ha fallado", "Something went wrong")}
        text={error.message || t("Error inesperado.", "Unexpected error.")}
        action={
          <Button label={t("Reintentar", "Retry")} icon="refresh" onPress={() => void retry()} />
        }
      />
    </View>
  );
}

function Root() {
  const { data: session, isPending } = useSession();
  const signedIn = Boolean(session?.user);
  const info = useQuery({
    queryKey: ["app-info"],
    queryFn: () => api<AppInfoDTO>("/api/app"),
    staleTime: 60 * 60_000,
  });

  useSharedContent(signedIn);

  // Notificaciones push: registrar el móvil y, al tocar una, abrir su pantalla.
  const pushOn = signedIn && info.data?.push === true;
  useEffect(() => {
    if (pushOn) registerForPush().catch(() => {});
  }, [pushOn]);
  const tapped = useNotificationTaps();
  const lastTap = useRef<string | null>(null);
  useEffect(() => {
    if (signedIn && tapped && tapped !== lastTap.current) {
      lastTap.current = tapped;
      openWebPath(tapped);
    }
  }, [signedIn, tapped]);

  if (isPending) return <Loading />;
  if (info.data && isOlder(APP_VERSION, info.data.minVersion)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Empty
          icon="arrow-up-circle-outline"
          title={t("Actualiza Doctor Deck", "Update Doctor Deck")}
          text={t(
            "Esta versión de la app ya no funciona con el servidor. Instala la última desde Google Play.",
            "This version of the app no longer works with the server. Install the latest one from Google Play.",
          )}
          action={
            <Button
              label={t("Abrir Google Play", "Open Google Play")}
              onPress={() => Linking.openURL("market://details?id=app.doctordeck")}
            />
          }
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="card/[oracleId]" options={{ title: "" }} />
        <Stack.Screen name="deck/[id]" options={{ title: "" }} />
        <Stack.Screen name="deck-new" options={{ title: t("Nuevo mazo", "New deck") }} />
        <Stack.Screen name="share" options={{ title: t("Importar", "Import") }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ title: t("Tu cuenta", "Your account") }} />
        <Stack.Screen name="play" options={{ title: t("Contador de vidas", "Life counter") }} />
        <Stack.Screen name="notifications" options={{ title: t("Avisos", "Notifications") }} />
        <Stack.Screen name="groups/index" options={{ title: t("Grupos de juego", "Playgroups") }} />
        <Stack.Screen name="groups/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="groups/join/[code]"
          options={{ title: t("Invitación", "Invitation") }}
        />
        <Stack.Screen name="games/[id]" options={{ title: t("Partida", "Game") }} />
        <Stack.Screen name="trades/index" options={{ title: t("Intercambios", "Trades") }} />
        <Stack.Screen name="trades/with/[username]" options={{ title: "" }} />
        <Stack.Screen name="trades/proposals/[id]" options={{ title: "" }} />
        <Stack.Screen name="loans" options={{ title: t("Préstamos", "Loans") }} />
        <Stack.Screen
          name="collection-prices"
          options={{ title: t("Precios de tu colección", "Your collection's prices") }}
        />
        <Stack.Screen name="community" options={{ title: t("Comunidad", "Community") }} />
        <Stack.Screen name="feed" options={{ title: t("Actividad", "Activity") }} />
        <Stack.Screen name="u/[username]" options={{ title: "" }} />
        <Stack.Screen name="settings" options={{ title: t("Ajustes", "Settings") }} />
        <Stack.Screen name="deck-comments/[id]" options={{ title: t("Comentarios", "Comments") }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: t("Crear cuenta", "Create account") }} />
        <Stack.Screen
          name="forgot"
          options={{ title: t("Recuperar la contraseña", "Reset your password") }}
        />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Al compartir algo con la app (texto o fichero CSV/TXT), lo recibe una actividad nativa propia
 * que lo guarda y abre la app como desde el icono (`share-intake`). Aquí se recoge al arrancar y
 * al volver a primer plano, va al buzón (`share-inbox`) y se abre la pantalla de importar, que lo
 * lee y lo reconoce con su progreso. Si aún no hay sesión, espera a que se entre.
 */
function useSharedContent(signedIn: boolean) {
  const inbox = useShareInbox();
  const pathname = usePathname();

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const check = () => {
      for (const ms of [0, 800, 2500])
        timers.push(setTimeout(() => void pollNativeShare().catch(() => {}), ms));
    };
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      sub.remove();
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (inbox && signedIn && pathname !== "/share") openShareScreen();
  }, [inbox, signedIn, pathname]);
}

/** La navegación puede no estar lista justo al arrancar: se reintenta unas cuantas veces. */
function openShareScreen(attempt = 0) {
  setTimeout(
    () => {
      try {
        router.navigate("/share");
      } catch {
        if (attempt < 10) openShareScreen(attempt + 1);
      }
    },
    attempt === 0 ? 0 : 300,
  );
}
