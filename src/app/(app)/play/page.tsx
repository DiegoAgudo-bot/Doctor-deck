import type { Metadata } from "next";
import { Suspense } from "react";
import { LifeCounter } from "@/components/life-counter";

export const metadata: Metadata = {
  title: "Contador de vidas · Deck Doctor",
  robots: { index: false },
};

export default function Page() {
  return (
    <Suspense>
      <LifeCounter />
    </Suspense>
  );
}
