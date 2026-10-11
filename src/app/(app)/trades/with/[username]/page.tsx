import { Suspense } from "react";
import { TradeCalculatorPage } from "@/components/trade-proposal-pages";

/** Calculadora de intercambio con otro usuario. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeCalculatorPage />
    </Suspense>
  );
}
