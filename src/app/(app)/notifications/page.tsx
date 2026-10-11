import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications-page";

export const metadata: Metadata = { title: "Notificaciones · Deck Doctor" };

export default function Page() {
  return <NotificationsPage />;
}
