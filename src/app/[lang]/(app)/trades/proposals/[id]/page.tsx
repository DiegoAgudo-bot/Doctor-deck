import { Suspense } from "react";
import { TradeProposalPage } from "@/components/trade-proposal-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Intercambios", "Trades"] });

/** Una propuesta de intercambio. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeProposalPage />
    </Suspense>
  );
}
