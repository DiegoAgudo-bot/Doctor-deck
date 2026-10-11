import type { Metadata } from "next";
import { Suspense } from "react";
import { LoansPage } from "@/components/loans-page";

export const metadata: Metadata = { title: "Préstamos · Deck Doctor", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <LoansPage />
    </Suspense>
  );
}
