import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar · Deck Doctor" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <LoginForm />
    </>
  );
}
