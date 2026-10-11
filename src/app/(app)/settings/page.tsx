import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = { title: "Ajustes · Doctor Deck" };

export default function Page() {
  return <SettingsPage />;
}
