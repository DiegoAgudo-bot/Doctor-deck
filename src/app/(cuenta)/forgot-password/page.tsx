import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar contraseña · Doctor Deck" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
