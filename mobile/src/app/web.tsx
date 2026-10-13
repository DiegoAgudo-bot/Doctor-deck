import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { Loading } from "~/components/ui";
import { authClient } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { colors } from "~/lib/theme";

/** Quita la cabecera y el pie de la web: la app ya tiene su barra. */
const HIDE_CHROME = `
(function () {
  var s = document.createElement('style');
  s.innerHTML = '.topbar, .bottomnav, .legalfoot { display: none !important; } .main { padding-bottom: 0 !important; }';
  (document.head || document.documentElement).appendChild(s);
})();
true;`;

/**
 * Las partes que la app no tiene en nativo (intercambios, grupos, préstamos, contador de vidas,
 * ajustes…) se abren de la web, con la sesión de la app (`/api/app/web` la pasa al WebView).
 */
export default function Web() {
  const { path = "/", title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const [cookie, setCookie] = useState<string | null>(null);
  useEffect(() => {
    authClient
      .getCookie()
      .then(setCookie)
      .catch(() => setCookie(""));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: title ?? "" }} />
      {cookie === null ? (
        <Loading />
      ) : (
        <WebView
          source={{
            uri: `${API_URL}/api/app/web?next=${encodeURIComponent(path)}`,
            headers: cookie ? { cookie } : {},
          }}
          style={{ backgroundColor: colors.bg }}
          injectedJavaScriptBeforeContentLoaded={HIDE_CHROME}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          startInLoadingState
          renderLoading={() => <Loading />}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
        />
      )}
    </View>
  );
}
