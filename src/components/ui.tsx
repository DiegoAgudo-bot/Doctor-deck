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
