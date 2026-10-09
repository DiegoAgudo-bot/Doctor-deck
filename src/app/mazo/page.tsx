import type { Metadata } from "next";
import { DeckDoctor } from "@/components/deck-doctor";

export const metadata: Metadata = { title: "Analizar mazo · Deck Doctor" };

export default function DeckPage() {
  return <DeckDoctor />;
}
