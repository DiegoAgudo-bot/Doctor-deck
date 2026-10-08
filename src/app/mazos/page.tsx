import type { Metadata } from "next";
import { SavedDecks } from "@/components/saved-decks";

export const metadata: Metadata = { title: "Mis mazos · Deck Doctor" };

export default function SavedDecksPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Mis mazos</h1>
      <p className="text-sm text-zinc-500">
        Las cartas de estos mazos cuentan como «en uso» al buscar mejoras para otros mazos.
      </p>
      <SavedDecks />
    </>
  );
}
