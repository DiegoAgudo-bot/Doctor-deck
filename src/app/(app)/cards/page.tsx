import type { Metadata } from "next";
import { Suspense } from "react";
import { CardsSearchPage } from "@/components/cards-pages";

export const metadata: Metadata = {
  title: "Buscar cartas · Doctor Deck",
  description: "Busca cualquier carta de Magic: precio, ediciones y mazos de Commander.",
};

export default function Page() {
  return (
    <Suspense>
      <CardsSearchPage />
    </Suspense>
  );
}
