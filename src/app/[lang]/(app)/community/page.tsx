import { CommunityPage } from "@/components/community-page";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Mazos de Commander de la comunidad", "Community Commander decks"],
  description: [
    "Mazos públicos de Commander de otros jugadores: filtra por colores, comandante o bracket y mira qué porcentaje tienes ya en tu colección y cuánto te costaría el resto.",
    "Public Commander decks from other players: filter by colors, commander or bracket and see what percentage you already own and what the rest would cost.",
  ],
  path: "/community",
});

export default function Page() {
  return <CommunityPage />;
}
