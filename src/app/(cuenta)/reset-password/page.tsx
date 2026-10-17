import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "Nueva contraseña · Doctor Deck",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
