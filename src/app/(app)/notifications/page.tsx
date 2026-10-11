import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata: Metadata = { title: "Notificaciones · Doctor Deck" };

export default function Page() {
  return <NotificationsPage />;
}
