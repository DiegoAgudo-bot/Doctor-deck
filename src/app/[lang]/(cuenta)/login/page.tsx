import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { getContainer } from "@/server/container";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Entrar", "Sign in"] });

/** Los métodos de login disponibles dependen de la configuración en tiempo de ejecución. */
async function Login() {
  await connection();
  const { google, passwordReset } = getContainer().authFeatures;
  return <LoginForm google={google} passwordReset={passwordReset} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
