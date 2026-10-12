"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconError, IconInfo, IconWarn, IconCheck, IconX } from "./icons";

type Tone = "info" | "warn" | "out" | "in";

const TONE_ICON: Record<Tone, ReactNode> = {
  info: <IconInfo size={15} />,
  warn: <IconWarn size={15} />,
  out: <IconError size={15} />,
  in: <IconCheck size={15} />,
};

/** Aviso en banda fina. `out` = error. */
export function Banner({
  tone,
  children,
  action,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "out" ? "alert" : "status"}
      className={`banner banner-${tone} ${action ? "stack-sm" : ""} ${className}`}
    >
      {TONE_ICON[tone]}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

/** Barra de progreso indeterminada + texto, para operaciones que tardan. */
export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="progress">
        <i />
      </div>
      <p style={{ fontSize: 13.5 }}>{children}</p>
    </div>
  );
}

/** Mientras carga una rejilla de cartas: huecos con la forma de las cartas. */
export function CardGridSkeleton({ count = 12, label }: { count?: number; label: string }) {
  return (
    <div
      className="grid gap-x-3 gap-y-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="skel" style={{ aspectRatio: "488/680", borderRadius: "4.5%" }} />
          <div className="skel" style={{ height: 10, width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/** Mientras carga una lista de tarjetas (mazos, grupos, avisos…). */
export function TilesSkeleton({
  count = 6,
  columns = 2,
  height = 92,
  label,
}: {
  count?: number;
  columns?: number;
  height?: number;
  label: string;
}) {
  return (
    <div
      className="grid-1-sm grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel flex items-center gap-3 p-3" style={{ height }}>
          <div className="skel flex-none" style={{ width: 46, aspectRatio: "488/680" }} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skel" style={{ height: 12, width: "55%" }} />
            <div className="skel" style={{ height: 10, width: "35%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado vacío: dos cartas en línea discontinua, título, texto y acción. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-9 text-center">
      <div className="relative h-[84px] w-[120px]" aria-hidden="true">
        <div
          className="absolute top-1 left-6 w-[54px] rounded-sm border border-dashed border-line-strong"
          style={{ aspectRatio: "488/680", transform: "rotate(-8deg)" }}
        />
        <div
          className="absolute top-0 left-12 w-[54px] rounded-sm border border-dashed border-line-strong"
          style={{ aspectRatio: "488/680", transform: "rotate(6deg)" }}
        />
      </div>
      <span className="h2">{title}</span>
      {children && <span className="muted max-w-[340px] text-[13px]">{children}</span>}
      {action}
    </div>
  );
}

/** Botón ↓/↑ junto a un desplegable de orden: de mayor a menor o al revés. */
export function SortDirButton({
  dir,
  onChange,
}: {
  dir: "asc" | "desc";
  onChange: (dir: "asc" | "desc") => void;
}) {
  const label = dir === "desc" ? "De mayor a menor" : "De menor a mayor";
  return (
    <button
      type="button"
      className="btn btn-icon"
      title={`${label} (clic para invertir)`}
      aria-label={`Orden: ${label.toLowerCase()}. Invertir`}
      onClick={() => onChange(dir === "desc" ? "asc" : "desc")}
    >
      <span aria-hidden="true" className="mono" style={{ fontSize: 15 }}>
        {dir === "desc" ? "↓" : "↑"}
      </span>
    </button>
  );
}

/** Diálogo modal nativo (<dialog>): Escape y el fondo lo cierran. */
export function Dialog({
  open,
  onClose,
  title,
  headerExtra,
  children,
  footer,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog m-auto"
      style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="flex flex-col">
          <div className="panel-h">
            <span id="dialog-title" className="h2">
              {title}
            </span>
            {headerExtra ?? (
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 26, height: 26 }}
                aria-label="Cerrar"
                onClick={onClose}
              >
                <IconX size={13} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 p-3.5">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-3.5 py-2.5">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Formatea números al estilo español (4.812). */
export const fmt = (n: number) => n.toLocaleString("es");

const rtf =
  typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("es", { numeric: "auto" }) : null;

/** "hace 3 días", "ayer"… */
export function ago(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
    ["year", Infinity],
  ];
  let value = diff;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size || unit === "year") {
      return rtf ? rtf.format(Math.round(value), unit) : new Date(iso).toLocaleDateString("es");
    }
    value /= size;
  }
  return "";
}
