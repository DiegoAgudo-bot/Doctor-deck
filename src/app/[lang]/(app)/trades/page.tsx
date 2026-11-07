import { TradesPage } from "@/components/trades-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Intercambios", "Trades"] });

export default function Page() {
  return <TradesPage />;
}
