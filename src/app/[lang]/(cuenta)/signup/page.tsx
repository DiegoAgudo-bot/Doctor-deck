import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { getContainer } from "@/server/container";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Crear cuenta gratis", "Create a free account"],
  description: [
    "Crea tu cuenta gratis de Doctor Deck: guarda tus mazos de Commander y tu colección en cualquier dispositivo, sigue a otros jugadores e intercambia cartas.",
    "Create your free Doctor Deck account: keep your Commander decks and collection on any device, follow other players and trade cards.",
  ],
  path: "/signup",
});

async function Register() {
  await connection();
  return <RegisterForm google={getContainer().authFeatures.google} />;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}
