import type { Metadata } from "next";
import { DeckDoctor } from "@/components/deck-doctor";

export const metadata: Metadata = { title: "Analizar mazo · Doctor Deck" };

export default function DeckPage() {
  return <DeckDoctor />;
}
