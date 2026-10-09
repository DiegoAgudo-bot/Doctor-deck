import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Entrar · Deck Doctor" };

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
