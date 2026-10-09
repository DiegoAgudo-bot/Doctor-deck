import type { Metadata } from "next";
import { SavedDecks } from "@/components/saved-decks";

export const metadata: Metadata = { title: "Mis mazos · Deck Doctor" };

export default function SavedDecksPage() {
  return <SavedDecks />;
}
