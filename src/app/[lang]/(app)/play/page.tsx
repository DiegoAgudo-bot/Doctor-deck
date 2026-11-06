import { Suspense } from "react";
import { LifeCounter } from "@/components/life-counter";
import { pageMetadata } from "@/server/i18n";

export const generateMetadata = pageMetadata({
  title: ["Contador de vidas para Commander", "Commander life counter"],
  description: [
    "Contador de vidas gratis para Magic: de 2 a 6 jugadores, 20, 30 o 40 vidas, daño de comandante, veneno y turnos. Funciona en el móvil y sin conexión.",
    "Free Magic life counter: 2 to 6 players, 20, 30 or 40 life, commander damage, poison and turns. Works on your phone and offline.",
  ],
  path: "/play",
});

export default function Page() {
  return (
    <Suspense>
      <LifeCounter />
    </Suspense>
  );
}
