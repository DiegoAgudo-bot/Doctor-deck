import type { Metadata } from "next";
import { Suspense } from "react";
import { TradeCalculatorPage } from "@/components/trade-proposal-pages";

export const metadata: Metadata = { title: "Intercambios · Doctor Deck", robots: { index: false } };

/** Calculadora de intercambio con otro usuario. El parámetro se lee dentro de Suspense. */
export default function Page() {
  return (
    <Suspense>
      <TradeCalculatorPage />
    </Suspense>
  );
}
