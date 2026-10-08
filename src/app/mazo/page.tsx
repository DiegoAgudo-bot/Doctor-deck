import type { Metadata } from "next";
import { DeckDoctor } from "@/components/deck-doctor";

export const metadata: Metadata = { title: "Mazo · Deck Doctor" };

export default function DeckPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Mazo</h1>
      <DeckDoctor />
    </>
  );
}
