import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminErrors } from "@/components/admin-errors";

export const metadata: Metadata = { title: "Errores · Doctor Deck", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AdminErrors />
    </Suspense>
  );
}
