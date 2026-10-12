"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDetailDTO } from "@/server/card-dto";
import type { CardDTO } from "@/server/dto";
import { api } from "./api-client";
import { IconX } from "./icons";
import { ManaCost } from "./mana";

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

/** Con ratón y pantalla ancha: carta al pasar por encima. Si no (táctil): hoja al tocar. */
const canHover = () => window.matchMedia("(hover: hover) and (min-width: 760px)").matches;

/** Lo que se toca dentro (o alrededor) de la carta y ya hace otra cosa. */
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role='button']";

type HoverCard = Pick<CardDTO, "name" | "imageUrl"> & { oracleId?: string };

/**
 * En el móvil, al tocar una carta: hoja desde abajo con la carta grande, su tipo, precio, cuántas
 * tengo y un enlace a su ficha. Los datos se piden al abrirla (`GET /api/cards/{oracleId}`).
 */
export function CardSheet({ card, onClose }: { card: HoverCard; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<CardDetailDTO | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (!card.oracleId) return;
    let alive = true;
    api<CardDetailDTO>(`/api/cards/${card.oracleId}`, undefined, { silent: true })
      .then((d) => alive && setDetail(d))
      .catch(() => {
        /* sin detalle: se ve solo la carta */
      });
    return () => {
      alive = false;
    };
  }, [card.oracleId]);

  const c = detail?.card;
  return (
    <dialog
      ref={ref}
      className="dialog sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
      aria-label={card.name}
    >
      <div className="sheet-grip" aria-hidden="true" />
      <div className="flex flex-col items-center gap-3 px-4 pt-1 pb-4">
        <div className="flex w-full items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="h2 flex items-center gap-2">
              <span className="truncate">{card.name}</span>
              {c?.manaCost && <ManaCost cost={c.manaCost} />}
            </span>
            {c && <span className="muted truncate text-[12.5px]">{c.typeLine}</span>}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            onClick={() => ref.current?.close()}
          >
            <IconX size={14} />
          </button>
        </div>
        <CardImage card={card} className="sheet-img" />
        {detail && (
          <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
            <span>
              <span className="subtle">Desde </span>
              <b className="mono">
                {detail.minPrice !== null ? formatEuros(detail.minPrice) : "—"}
              </b>
            </span>
            {detail.mine && (
              <span>
                {detail.mine.owned === 0 ? (
                  <span className="subtle">No la tienes</span>
                ) : (
                  <>
                    Tienes <b>{detail.mine.owned}</b>
                    <span className="subtle"> · {detail.mine.free} libres</span>
                  </>
                )}
              </span>
            )}
          </div>
        )}
        {card.oracleId && (
          <Link className="btn btn-primary w-full justify-center" href={`/cards/${card.oracleId}`}>
            Ver ficha
          </Link>
        )}
      </div>
    </dialog>
  );
}

const supportsPopover = () =>
  typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

/**
 * Envuelve un nombre (o fila) y muestra la carta grande al pasar el ratón (solo con ratón y
 * pantalla ancha); en el móvil, al tocarla se abre `CardSheet`. La carta va en la capa superior del navegador (Popover API; si no lo hay, en
 * <body>) con posición fija: ningún contenedor con `overflow` ni ningún diálogo la corta o tapa.
 */
export function CardHover({
  card,
  children,
  className = "",
  as: Tag = "span",
}: {
  card: HoverCard;
  children: ReactNode;
  className?: string;
  as?: "span" | "div";
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet, setSheet] = useState(false);
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
        if (canHover()) setPos(previewPosition(e));
      }}
      onMouseLeave={() => setPos(null)}
      onClick={(e) => {
        // En táctil, tocar la carta abre la hoja, salvo que se toque un botón o enlace (dentro o
        // alrededor), que hace lo suyo.
        if (canHover() || sheet) return;
        if ((e.target as Element).closest(INTERACTIVE)) return;
        if (e.currentTarget.parentElement?.closest(INTERACTIVE)) return;
        setSheet(true);
      }}
    >
      {children}
      {native ? preview : pos && createPortal(preview, document.body)}
      {sheet &&
        createPortal(<CardSheet card={card} onClose={() => setSheet(false)} />, document.body)}
    </Tag>
  );
}
