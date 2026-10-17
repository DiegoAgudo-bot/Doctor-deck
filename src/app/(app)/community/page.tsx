import type { Metadata } from "next";
import { CommunityPage } from "@/components/community-page";

export const metadata: Metadata = {
  title: "Mazos de Commander de la comunidad · Doctor Deck",
  description:
    "Mazos públicos de Commander de otros jugadores: filtra por colores, comandante o bracket y mira qué porcentaje tienes ya en tu colección y cuánto te costaría el resto.",
  alternates: { canonical: "/community" },
};

export default function Page() {
  return <CommunityPage />;
}
