import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupPage } from "@/components/groups-pages";

export const metadata: Metadata = { title: "Grupo · Doctor Deck", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <GroupPage />
    </Suspense>
  );
}
