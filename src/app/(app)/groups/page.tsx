import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupsPage } from "@/components/groups-pages";

export const metadata: Metadata = { title: "Grupos · Deck Doctor", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <GroupsPage />
    </Suspense>
  );
}
