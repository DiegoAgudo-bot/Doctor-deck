import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQuery } from "@tanstack/react-query";
import {
  Stack,
  ThemeProvider,
  DarkTheme,
  router,
  usePathname,
  type ErrorBoundaryProps,
} from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
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
import { putShare } from "~/lib/share-inbox";
import { itemFromIntent, pollNativeShare, useShareInbox } from "~/lib/share-intake";
import { colors } from "~/lib/theme";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.panel,
    border: colors.line,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60_000, buster: APP_VERSION }}
      >
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Root />
          <ToastHost />
          <DialogHost />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ShareIntentProvider>
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
        title="Algo ha fallado"
        text={error.message || "Error inesperado."}
        action={<Button label="Reintentar" icon="refresh" onPress={() => void retry()} />}
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
          title="Actualiza Doctor Deck"
          text="Esta versión de la app ya no funciona con el servidor. Instala la última desde Google Play."
          action={
            <Button
              label="Abrir Google Play"
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
        <Stack.Screen name="deck-new" options={{ title: "Nuevo mazo" }} />
        <Stack.Screen name="share" options={{ title: "Importar" }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ title: "Tu cuenta" }} />
        <Stack.Screen name="play" options={{ title: "Contador de vidas" }} />
        <Stack.Screen name="notifications" options={{ title: "Avisos" }} />
        <Stack.Screen name="groups/index" options={{ title: "Grupos de juego" }} />
        <Stack.Screen name="groups/[id]" options={{ title: "" }} />
        <Stack.Screen name="groups/join/[code]" options={{ title: "Invitación" }} />
        <Stack.Screen name="games/[id]" options={{ title: "Partida" }} />
        <Stack.Screen name="trades/index" options={{ title: "Intercambios" }} />
        <Stack.Screen name="trades/with/[username]" options={{ title: "" }} />
        <Stack.Screen name="trades/proposals/[id]" options={{ title: "" }} />
        <Stack.Screen name="loans" options={{ title: "Préstamos" }} />
        <Stack.Screen name="community" options={{ title: "Comunidad" }} />
        <Stack.Screen name="feed" options={{ title: "Actividad" }} />
        <Stack.Screen name="u/[username]" options={{ title: "" }} />
        <Stack.Screen name="settings" options={{ title: "Ajustes" }} />
        <Stack.Screen name="deck-comments/[id]" options={{ title: "Comentarios" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: "Crear cuenta" }} />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Al compartir algo con la app (texto o fichero CSV/TXT), va al buzón (`share-inbox`) y se abre la
 * pantalla de importar, que lo lee y lo reconoce con su progreso. Llega por el evento del módulo
 * nativo y, por si ese evento se pierde, se le pregunta al arrancar y al volver a primer plano.
 * Mientras haya algo en el buzón sin recoger, se vuelve a abrir la pantalla de importar. Si aún
 * no hay sesión, espera a que se entre.
 */
function useSharedContent(signedIn: boolean) {
  const { hasShareIntent, shareIntent, error } = useShareIntentContext();
  const inbox = useShareInbox();
  const pathname = usePathname();

  useEffect(() => {
    // Si no se ha podido recibir, también: la pantalla de importar enseña el error.
    if (hasShareIntent) putShare(itemFromIntent(shareIntent));
    else if (error) putShare({ kind: "error", message: error });
  }, [hasShareIntent, shareIntent, error]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const check = () => {
      for (const ms of [300, 1500, 4000])
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
