import type { Metadata } from "next";
import { TradesPage } from "@/components/trades-page";

export const metadata: Metadata = { title: "Intercambios · Doctor Deck" };

export default function Page() {
  return <TradesPage />;
}
