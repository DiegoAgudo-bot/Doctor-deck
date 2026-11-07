import { Suspense } from "react";
import { GamePage } from "@/components/game-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({ title: ["Partida", "Game"] });

export default function Page() {
  return (
    <Suspense>
      <GamePage />
    </Suspense>
  );
}
