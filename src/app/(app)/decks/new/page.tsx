import type { Metadata } from "next";
import { NewDeckWizard } from "@/components/new-deck-wizard";

export const metadata: Metadata = {
  title: "Crear un mazo de Commander · Doctor Deck",
  description:
    "Elige un comandante y empieza con el mazo medio de la comunidad, con las cartas que ya tienes o desde cero. También puedes importar una lista o un enlace.",
  alternates: { canonical: "/decks/new" },
};

export default function Page() {
  return <NewDeckWizard />;
}
