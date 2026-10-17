import type { Metadata } from "next";
import { TradesPage } from "@/components/trades-page";

export const metadata: Metadata = { title: "Intercambios · Doctor Deck", robots: { index: false } };

export default function Page() {
  return <TradesPage />;
}
