"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

const PREVIEW_W = 230;
const PREVIEW_H = Math.round((PREVIEW_W * 680) / 488);
const MARGIN = 8;

/**
 * Dónde poner la carta grande: al lado del elemento (o del ratón, si el elemento es una fila
 * ancha), a la derecha o, si no cabe, a la izquierda, y siempre dentro de la ventana.
 */
function previewPosition(e: ReactMouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  const wide = r.width > 360;
  const right = (wide ? e.clientX : r.right) + 14;
  const left =
    right + PREVIEW_W <= window.innerWidth - MARGIN
      ? right
      : Math.max(MARGIN, (wide ? e.clientX : r.left) - 14 - PREVIEW_W);
  const top = Math.min(
    Math.max(MARGIN, r.top + r.height / 2 - PREVIEW_H / 2),
    window.innerHeight - PREVIEW_H - MARGIN,
  );
  return { left, top };
}

const supportsPopover = () =>
  typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

/**
 * Envuelve un nombre (o fila) y muestra la carta grande al pasar el ratón (solo con ratón y
 * pantalla ancha). La carta va en la capa superior del navegador (Popover API; si no lo hay, en
 * <body>) con posición fija: ningún contenedor con `overflow` ni ningún diálogo la corta o tapa.
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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const native = supportsPopover();

  useEffect(() => {
    const el = pop.current;
    if (!el || !native) return;
    try {
      if (pos && !el.matches(":popover-open")) el.showPopover();
      if (!pos && el.matches(":popover-open")) el.hidePopover();
    } catch {
      /* ya estaba así */
    }
  }, [pos, native]);

  // Al hacer scroll la carta se quedaría flotando en otro sitio: se oculta.
  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [pos]);

  const preview = (
    <span
      ref={pop}
      popover={native ? "manual" : undefined}
      className={`pv ${native ? "" : "pv-portal"}`}
      aria-hidden="true"
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      <CardImage card={card} />
    </span>
  );

  return (
    <Tag
      className={`hov ${className}`}
      onMouseEnter={(e) => {
        if (window.matchMedia("(hover: hover) and (min-width: 760px)").matches) {
          setPos(previewPosition(e));
        }
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {native ? preview : pos && createPortal(preview, document.body)}
    </Tag>
  );
}
