import type { Metadata } from "next";
import { Suspense } from "react";
import { TradeProposalPage } from "@/components/trade-proposal-pages";

export const metadata: Metadata = { title: "Intercambios · Doctor Deck", robots: { index: false } };

/** Una propuesta de intercambio. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeProposalPage />
    </Suspense>
  );
}
