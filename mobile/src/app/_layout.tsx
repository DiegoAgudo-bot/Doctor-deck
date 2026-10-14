import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { Stack, ThemeProvider, DarkTheme, router } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Linking, View } from "react-native";
import type { AppInfoDTO } from "@/server/dto";
import { ToastHost } from "~/components/toast";
import { Button, Empty, Loading } from "~/components/ui";
import { api } from "~/lib/api";
import { useSession } from "~/lib/auth";
import { APP_VERSION } from "~/lib/config";
import { isOlder } from "~/lib/format";
import { openWebPath, registerForPush, useNotificationTaps } from "~/lib/push";
import { persister, queryClient } from "~/lib/query";
import { setPendingImport } from "~/lib/shared";
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
        <Stack.Screen name="web" options={{ title: "" }} />
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
 * hay sesión, espera a que se entre.
 */
function useSharedContent(signedIn: boolean) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!hasShareIntent || !signedIn) return;
    (async () => {
      const file = shareIntent.files?.[0];
      const text = file ? await new File(file.path).text() : (shareIntent.text ?? "");
      resetShareIntent();
      if (!text.trim()) return;
      setPendingImport(text, file?.fileName ?? "Lista compartida");
      router.push("/share");
    })().catch(() => resetShareIntent());
  }, [hasShareIntent, signedIn, shareIntent, resetShareIntent]);
}
