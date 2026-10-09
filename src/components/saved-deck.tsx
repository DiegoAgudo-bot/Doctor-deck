"use client";

import { useParams } from "next/navigation";
import { DeckDoctor } from "./deck-doctor";

/** La key fuerza un estado limpio al pasar de un mazo a otro. */
export function SavedDeck() {
  const { id } = useParams<{ id: string }>();
  return <DeckDoctor key={id} deckId={id} />;
}
