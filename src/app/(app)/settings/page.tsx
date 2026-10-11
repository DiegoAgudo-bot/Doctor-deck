import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = { title: "Ajustes · Deck Doctor" };

export default function Page() {
  return <SettingsPage />;
}
