import { DeckDoctor } from "@/components/deck-doctor";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Analizar un mazo de Commander gratis", "Analyze a Commander deck for free"],
  description: [
    "Pega tu lista o el enlace de tu mazo de Commander y recibe cambios 1×1 con las cartas de tu colección: curva de maná, roles (tierras, ramp, robo, removal), bracket y combos.",
    "Paste your Commander decklist or link and get 1-for-1 swaps using the cards in your collection: mana curve, roles (lands, ramp, draw, removal), bracket and combos.",
  ],
  path: "/analyze",
});

export default function DeckPage() {
  return <DeckDoctor />;
}
