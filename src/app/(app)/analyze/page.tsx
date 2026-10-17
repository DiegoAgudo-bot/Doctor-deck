import type { Metadata } from "next";
import { DeckDoctor } from "@/components/deck-doctor";

export const metadata: Metadata = {
  title: "Analizar un mazo de Commander gratis · Doctor Deck",
  description:
    "Pega tu lista o el enlace de tu mazo de Commander y recibe cambios 1×1 con las cartas de tu colección: curva de maná, roles (tierras, ramp, robo, removal), bracket y combos.",
  alternates: { canonical: "/analyze" },
};

export default function DeckPage() {
  return <DeckDoctor />;
}
