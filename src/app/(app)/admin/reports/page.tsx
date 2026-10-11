import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminReports } from "@/components/admin-reports";

export const metadata: Metadata = { title: "Denuncias · Deck Doctor", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AdminReports />
    </Suspense>
  );
}
