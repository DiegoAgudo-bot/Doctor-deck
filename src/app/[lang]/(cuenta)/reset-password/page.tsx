import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth-forms";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Nueva contraseña", "New password"] });

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
