import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Banner, Button, Field, T } from "~/components/ui";
import { authClient } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { isEn, t } from "~/lib/i18n";
import { colors } from "~/lib/theme";

/**
 * «He olvidado la contraseña», sin salir de la app: se pide el enlace por correo. El enlace abre
 * la página de la web donde se pone la contraseña nueva; después se entra aquí con ella.
 */
export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${API_URL}${isEn ? "/en" : ""}/reset-password`,
    });
    setBusy(false);
    if (e) {
      setError(
        e.status === 429
          ? t("Demasiados intentos: espera un momento.", "Too many attempts: wait a moment.")
          : t(
              "No se ha podido enviar el correo. Comprueba la conexión y vuelve a probar.",
              "Couldn't send the email. Check your connection and try again.",
            ),
      );
      return;
    }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {sent ? (
          <>
            <Banner
              tone="ok"
              text={t(
                "Si hay una cuenta con ese email, te hemos mandado un enlace para poner una contraseña nueva. Mira también en la carpeta de spam.",
                "If there's an account with that email, we've sent you a link to set a new password. Check your spam folder too.",
              )}
            />
            <T variant="muted">
              {t(
                "Cuando la hayas cambiado, vuelve aquí y entra con la nueva.",
                "Once you've changed it, come back here and sign in with the new one.",
              )}
            </T>
            <Button label={t("Volver a entrar", "Back to sign in")} onPress={() => router.back()} />
          </>
        ) : (
          <>
            <T variant="muted">
              {t(
                "Escribe el email de tu cuenta y te mandamos un enlace para poner una contraseña nueva.",
                "Enter your account's email and we'll send you a link to set a new password.",
              )}
            </T>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={() => email.includes("@") && void send()}
            />
            {error && <Banner text={error} />}
            <Button
              label={t("Enviar enlace", "Send link")}
              onPress={send}
              busy={busy}
              disabled={!email.includes("@")}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
