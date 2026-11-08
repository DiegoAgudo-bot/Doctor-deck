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
import { t } from "~/lib/i18n";

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
          ? t("Email o contraseña incorrectos.", "Wrong email or password.")
          : (e.message ?? t("No se ha podido entrar.", "Couldn't sign in.")),
      );
    setBusy(null);
  };

  const google = async () => {
    setBusy("google");
    setError(null);
    await clearCache();
    const { error: e } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/home",
    });
    if (e) {
      setError(
        e.code === "ACCOUNT_NOT_LINKED" || e.message?.includes("account_not_linked")
          ? t(
              "Ya tienes cuenta con ese email: entra con tu contraseña y vincula Google desde Más › Ajustes.",
              "You already have an account with that email: sign in with your password and link Google from More › Settings.",
            )
          : (e.message ?? t("No se ha podido entrar con Google.", "Couldn't sign in with Google.")),
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
              {t(
                "Tu colección y tus mazos de Commander, con sugerencias de la comunidad.",
                "Your Commander collection and decks, with suggestions from the community.",
              )}
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
            label={t("Contraseña", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={signIn}
          />
          <Button
            label={t("Entrar", "Sign in")}
            onPress={signIn}
            busy={busy === "email"}
            disabled={!email || password.length < 8}
          />
          {info.data?.google !== false && (
            <Button
              label={t("Continuar con Google", "Continue with Google")}
              icon="logo-google"
              kind="secondary"
              onPress={google}
              busy={busy === "google"}
            />
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Link href="/signup">
              <T style={{ color: colors.accent }}>{t("Crear cuenta", "Create account")}</T>
            </Link>
            {info.data?.passwordReset && (
              <T
                style={{ color: colors.accent }}
                onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)}
              >
                {t("He olvidado la contraseña", "I forgot my password")}
              </T>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
