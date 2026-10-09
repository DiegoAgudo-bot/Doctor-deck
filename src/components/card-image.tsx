"use client";

import { useState, type ReactNode } from "react";
import type { CardDTO } from "@/server/dto";

/** Imagen de Scryfall (488×680); si no hay o no carga (sin conexión), un hueco con el nombre. */
export function CardImage({
  card,
  className = "",
  style,
}: {
  card: Pick<CardDTO, "name" | "imageUrl">;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (!card.imageUrl || failed) {
    return (
      <div
        className={`cardimg cardimg-missing ${className}`}
        style={style}
        role="img"
        aria-label={card.name}
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
      className={`cardimg ${className}`}
      style={style}
    />
  );
}

/**
 * Envuelve un nombre (o fila) y muestra la carta grande al pasar el ratón (solo escritorio; en
 * móvil no hay hover y se oculta).
 */
export function CardHover({
  card,
  children,
  className = "",
  as: Tag = "span",
}: {
  card: Pick<CardDTO, "name" | "imageUrl">;
  children: ReactNode;
  className?: string;
  as?: "span" | "div";
}) {
  return (
    <Tag className={`hov ${className}`}>
      {children}
      <span className="pv hide-sm" aria-hidden="true">
        <CardImage card={card} />
      </span>
    </Tag>
  );
}
