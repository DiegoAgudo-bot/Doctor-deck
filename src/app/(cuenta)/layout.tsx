import { BareShell } from "@/components/app-shell";

/** Entrar, registro y contraseña: sin barras, centradas. */
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <BareShell>{children}</BareShell>;
}
