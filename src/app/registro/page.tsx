import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { getContainer } from "@/server/container";

export const metadata: Metadata = { title: "Crear cuenta · Deck Doctor" };

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
