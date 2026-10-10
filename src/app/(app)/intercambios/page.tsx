import type { Metadata } from "next";
import { TradesPage } from "@/components/trades-page";

export const metadata: Metadata = { title: "Intercambios · Deck Doctor" };

export default function Page() {
  return <TradesPage />;
}
