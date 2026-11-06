import { ForgotPasswordForm } from "@/components/auth-forms";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Recuperar contraseña", "Recover your password"],
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
