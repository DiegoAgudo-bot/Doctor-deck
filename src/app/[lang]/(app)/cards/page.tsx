import { Suspense } from "react";
import { CardsSearchPage } from "@/components/cards-pages";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Buscador de cartas de Magic", "Magic card search"],
  description: [
    "Busca cualquier carta de Magic: The Gathering por nombre, texto, tipo, colores o coste: precio, ediciones, comandantes y mazos de Commander.",
    "Search any Magic: The Gathering card by name, text, type, colors or cost: price, printings, commanders and Commander decks.",
  ],
  path: "/cards",
});

export default function Page() {
  return (
    <Suspense>
      <CardsSearchPage />
    </Suspense>
  );
}
