import type { Metadata } from "next";
import { Suspense } from "react";
import { GamePage } from "@/components/game-page";

export const metadata: Metadata = { title: "Partida · Deck Doctor", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <GamePage />
    </Suspense>
  );
}
