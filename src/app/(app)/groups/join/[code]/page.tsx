import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinGroupPage } from "@/components/groups-pages";

export const metadata: Metadata = {
  title: "Invitación a un grupo · Doctor Deck",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense>
      <JoinGroupPage />
    </Suspense>
  );
}
