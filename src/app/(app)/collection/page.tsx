import type { Metadata } from "next";
import { CollectionPage } from "@/components/collection-page";

export const metadata: Metadata = {
  title: "Gestiona tu colección de Magic · Doctor Deck",
  description:
    "Importa el CSV de tu colección de Magic o añade cartas a mano (edición, foil, idioma y estado): su valor, el histórico de precios y en qué mazos usas cada carta.",
  alternates: { canonical: "/collection" },
};

export default function Page() {
  return <CollectionPage />;
}
