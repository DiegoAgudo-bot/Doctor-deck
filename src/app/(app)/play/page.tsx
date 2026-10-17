import type { Metadata } from "next";
import { Suspense } from "react";
import { LifeCounter } from "@/components/life-counter";

export const metadata: Metadata = {
  title: "Contador de vidas para Commander · Doctor Deck",
  description:
    "Contador de vidas gratis para Magic: de 2 a 6 jugadores, 20, 30 o 40 vidas, daño de comandante, veneno y turnos. Funciona en el móvil y sin conexión.",
  alternates: { canonical: "/play" },
};

export default function Page() {
  return (
    <Suspense>
      <LifeCounter />
    </Suspense>
  );
}
