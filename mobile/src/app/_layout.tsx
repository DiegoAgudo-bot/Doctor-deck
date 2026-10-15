import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { readAsStringAsync } from "expo-file-system/legacy";
import { Stack, ThemeProvider, DarkTheme, router } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Alert, Linking, View } from "react-native";
import type { AppInfoDTO } from "@/server/dto";
import { toast, ToastHost } from "~/components/toast";
import { Button, Empty, Loading } from "~/components/ui";
import { api } from "~/lib/api";
import { useSession } from "~/lib/auth";
import { APP_VERSION } from "~/lib/config";
import { isOlder } from "~/lib/format";
import { openWebPath, registerForPush, useNotificationTaps } from "~/lib/push";
import { persister, queryClient } from "~/lib/query";
import { setPendingImport, takePendingImport } from "~/lib/shared";
import { shareFileUri } from "~/lib/share-path";
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
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ShareIntentProvider>
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
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="card/[oracleId]" options={{ title: "" }} />
        <Stack.Screen name="deck/[id]" options={{ title: "" }} />
        <Stack.Screen name="deck-new" options={{ title: "Nuevo mazo" }} />
        <Stack.Screen name="share" options={{ title: "Importar" }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
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
 * Lo compartido desde ManaBox (texto o fichero CSV/TXT) va a la pantalla de importar. Si aún no
 * hay sesión, espera a que se entre. Si no se puede leer, se avisa (antes fallaba en silencio y
 * solo se abría la app).
 */
function useSharedContent(signedIn: boolean) {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  useEffect(() => {
    if (error) toast(`No se ha podido recibir lo compartido: ${error}`);
  }, [error]);
  // `resetShareIntent` cambia en cada render: sin esto, el mismo envío se leería varias veces.
  const handled = useRef<typeof shareIntent | null>(null);
  useEffect(() => {
    if (!hasShareIntent || !signedIn || handled.current === shareIntent) return;
    handled.current = shareIntent;
    (async () => {
      const file = shareIntent.files?.[0];
      const text = file ? await readSharedFile(file.path) : (shareIntent.text ?? "");
      if (!text.trim()) {
        resetShareIntent();
        toast("Lo compartido está vacío.");
        return;
      }
      setPendingImport(text, file?.fileName ?? "Lista compartida");
      resetShareIntent();
      openShareScreen();
    })().catch((e: unknown) => {
      resetShareIntent();
      Alert.alert(
        "No se ha podido abrir lo compartido",
        `${e instanceof Error ? e.message : String(e)}\n\nPrueba a exportar el CSV y elegirlo desde Colección › + › Importar.`,
      );
    });
  }, [hasShareIntent, signedIn, shareIntent, resetShareIntent]);
}

/** Lee el fichero compartido; si la API nueva no puede con la ruta, con la antigua. */
async function readSharedFile(path: string): Promise<string> {
  try {
    return await new File(shareFileUri(path)).text();
  } catch (first) {
    try {
      return await readAsStringAsync(shareFileUri(path));
    } catch {
      throw first;
    }
  }
}

/**
 * Abre la pantalla de importar. Al arrancar la app desde «Compartir», la navegación puede no
 * estar lista todavía: se reintenta unas cuantas veces.
 */
function openShareScreen(attempt = 0) {
  setTimeout(
    () => {
      try {
        router.push("/share");
      } catch {
        if (attempt < 10) openShareScreen(attempt + 1);
        else {
          takePendingImport();
          toast("No se ha podido abrir la pantalla de importar. Vuelve a compartirlo.");
        }
      }
    },
    attempt === 0 ? 0 : 300,
  );
}
