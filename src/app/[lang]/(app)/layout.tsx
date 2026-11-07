import { AppShell } from "@/components/app-shell";

/** La app: barra superior, lateral con tus mazos y barra inferior en móvil. */
export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return <AppShell>{children}</AppShell>;
}
