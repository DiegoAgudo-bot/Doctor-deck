import { Suspense } from "react";
import { SavedDeck } from "@/components/saved-deck";

/** Un mazo guardado: /decks/{uuid}. El id se lee dentro de Suspense (Cache Components). */
export default function SavedDeckPage() {
  return (
    <Suspense>
      <SavedDeck />
    </Suspense>
  );
}
