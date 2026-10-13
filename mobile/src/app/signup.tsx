import { useState } from "react";
import { ScrollView } from "react-native";
import { Banner, Button, Field, T } from "~/components/ui";
import { authClient } from "~/lib/auth";
import { clearCache } from "~/lib/query";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    await clearCache();
    const { error: e } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (e) setError(e.message ?? "No se ha podido crear la cuenta.");
    setBusy(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <T variant="muted">
        Con cuenta, tu colección y tus mazos se guardan y los ves también en la web.
      </T>
      {error && <Banner text={error} />}
      <Field label="Nombre" value={name} onChangeText={setName} autoComplete="name" />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Contraseña (mínimo 8)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Button
        label="Crear cuenta"
        onPress={submit}
        busy={busy}
        disabled={!name.trim() || !email.includes("@") || password.length < 8}
      />
    </ScrollView>
  );
}
