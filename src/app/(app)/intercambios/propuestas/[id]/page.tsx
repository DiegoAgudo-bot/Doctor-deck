import { Suspense } from "react";
import { TradeProposalPage } from "@/components/trade-proposal-pages";

/** Una propuesta de intercambio. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeProposalPage />
    </Suspense>
  );
}
