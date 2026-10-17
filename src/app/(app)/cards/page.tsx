import type { Metadata } from "next";
import { Suspense } from "react";
import { CardsSearchPage } from "@/components/cards-pages";

export const metadata: Metadata = {
  title: "Buscador de cartas de Magic · Doctor Deck",
  description:
    "Busca cualquier carta de Magic: The Gathering por nombre, texto, tipo, colores o coste: precio, ediciones, comandantes y mazos de Commander.",
  alternates: { canonical: "/cards" },
};

export default function Page() {
  return (
    <Suspense>
      <CardsSearchPage />
    </Suspense>
  );
}
