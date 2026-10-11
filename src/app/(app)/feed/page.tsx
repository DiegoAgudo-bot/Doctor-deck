import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedPage } from "@/components/feed-page";

export const metadata: Metadata = { title: "Actividad · Doctor Deck", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <FeedPage />
    </Suspense>
  );
}
