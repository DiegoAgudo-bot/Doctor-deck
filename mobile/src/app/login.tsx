import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppInfoDTO } from "@/server/dto";
import { Banner, Button, Field, T } from "~/components/ui";
import { api } from "~/lib/api";
import { authClient } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { clearCache } from "~/lib/query";
import { colors } from "~/lib/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const info = useQuery({ queryKey: ["app-info"], queryFn: () => api<AppInfoDTO>("/api/app") });

  const signIn = async () => {
    setBusy("email");
    setError(null);
    await clearCache();
    const { error: e } = await authClient.signIn.email({ email: email.trim(), password });
    if (e)
      setError(
        e.status === 401
          ? "Email o contraseña incorrectos."
          : (e.message ?? "No se ha podido entrar."),
      );
    setBusy(null);
  };

  const google = async () => {
    setBusy("google");
    setError(null);
    await clearCache();
    const { error: e } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/collection",
    });
    if (e) {
      setError(
        e.code === "ACCOUNT_NOT_LINKED" || e.message?.includes("account_not_linked")
          ? "Ya tienes cuenta con ese email: entra con tu contraseña y vincula Google desde Más › Ajustes."
          : (e.message ?? "No se ha podido entrar con Google."),
      );
    }
    setBusy(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 72, height: 72, borderRadius: 16 }}
            />
            <T variant="title">Doctor Deck</T>
            <T variant="muted" style={{ textAlign: "center" }}>
              Tu colección y tus mazos de Commander, con sugerencias de la comunidad.
            </T>
          </View>
          {error && <Banner text={error} />}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={signIn}
          />
          <Button
            label="Entrar"
            onPress={signIn}
            busy={busy === "email"}
            disabled={!email || password.length < 8}
          />
          {info.data?.google !== false && (
            <Button
              label="Continuar con Google"
              icon="logo-google"
              kind="secondary"
              onPress={google}
              busy={busy === "google"}
            />
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Link href="/signup">
              <T style={{ color: colors.accent }}>Crear cuenta</T>
            </Link>
            {info.data?.passwordReset && (
              <T
                style={{ color: colors.accent }}
                onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)}
              >
                He olvidado la contraseña
              </T>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
