import { BareShell } from "@/components/app-shell";

/** Entrar, registro y contraseña: sin barras, centradas. */
export default function AccountLayout({ children }: LayoutProps<"/[lang]">) {
  return <BareShell>{children}</BareShell>;
}
