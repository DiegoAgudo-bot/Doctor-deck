import { NotificationsPage } from "@/components/notifications-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Notificaciones", "Notifications"] });

export default function Page() {
  return <NotificationsPage />;
}
