import { Suspense } from "react";
import { TradeCalculatorPage } from "@/components/trade-proposal-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Intercambios", "Trades"] });

/** Calculadora de intercambio con otro usuario. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeCalculatorPage />
    </Suspense>
  );
}
