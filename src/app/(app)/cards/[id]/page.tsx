import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CardDetailPage } from "@/components/cards-pages";
import { getContainer } from "@/server/container";

/** Título con el nombre de la carta (para compartir y buscadores). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Se lee de la BD en cada petición (no en el build).
  await connection();
  const [card] = await getContainer().cards.findCardsByOracleIds([(await params).id.slice(0, 64)]);
  if (!card) return { title: "Carta · Doctor Deck", robots: { index: false } };
  return {
    title: `${card.name} · Doctor Deck`,
    description: `${card.name} (${card.typeLine}): precio, ediciones y mazos de Commander.`,
  };
}

/** Ficha de una carta: /cards/{oracleId}. El id se lee dentro de Suspense (Cache Components). */
export default function Page() {
  return (
    <Suspense>
      <CardDetailPage />
    </Suspense>
  );
}
