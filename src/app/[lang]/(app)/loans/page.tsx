import { Suspense } from "react";
import { LoansPage } from "@/components/loans-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Préstamos", "Loans"] });

export default function Page() {
  return (
    <Suspense>
      <LoansPage />
    </Suspense>
  );
}
