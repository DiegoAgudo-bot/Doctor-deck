"use client";

import { useState } from "react";
import type { CardDTO } from "@/server/dto";

/** Imagen de Scryfall; si no hay o no carga (sin conexión), un recuadro con el nombre. */
export function CardImage({ card, className = "" }: { card: CardDTO; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!card.imageUrl || failed) {
    return (
      <div
        className={`flex aspect-[488/680] items-center justify-center rounded-[4.5%] border border-zinc-300 bg-zinc-100 p-2 text-center text-xs dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
      >
        {card.name}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imágenes de Scryfall servidas por su CDN
    <img
      src={card.imageUrl}
      alt={card.name}
      loading="lazy"
      width={488}
      height={680}
      onError={() => setFailed(true)}
      className={`aspect-[488/680] h-auto rounded-[4.5%] ${className}`}
    />
  );
}
