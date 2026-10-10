"use client";

import { useId, useRef, useState } from "react";
import type { PricePoint } from "@/domain/prices/history";
import { formatEuros } from "@/domain/suggestions/format";

const W = 600;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 56 };

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Gráfica de una serie de precios (EUR por día): línea de 2 px con un velo debajo, ejes
 * discretos, cruceta con tooltip (ratón, toque y flechas del teclado) y la tabla de datos debajo.
 * `label` nombra la serie (no hay leyenda: es una sola).
 */
export function PriceChart({ points, label }: { points: readonly PricePoint[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  if (points.length < 2) {
    return (
      <p className="subtle text-[13px]">
        {points.length === 0
          ? "Todavía no hay histórico de precios."
          : `Solo hay precio de un día (${shortDate(points[0]!.date)}): ${formatEuros(points[0]!.eur)}. El histórico se va guardando cada noche.`}
      </p>
    );
  }

  const values = points.map((p) => p.eur);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Un poco de aire arriba y abajo; si el precio no cambia, una banda de ±10 %.
  const span = max - min || max * 0.2 || 1;
  const lo = Math.max(0, min - span * 0.1);
  const hi = max + span * 0.1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.eur).toFixed(1)}`);
  const area = `${line.join(" ")} L${x(points.length - 1)},${H - PAD.bottom} L${x(0)},${H - PAD.bottom} Z`;
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const last = points.length - 1;
  const shown = active ?? last;
  const point = points[shown]!;

  function pick(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((vx - PAD.left) / (W - PAD.left - PAD.right)) * last);
    setActive(Math.min(last, Math.max(0, i)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 text-[13px]">
        <b className="mono" style={{ fontSize: 15 }}>
          {formatEuros(point.eur)}
        </b>
        <span className="subtle">
          {label} · {shortDate(point.date)}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "auto", touchAction: "pan-y", outline: "none" }}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive(Math.max(0, shown - 1));
          else if (e.key === "ArrowRight") setActive(Math.min(last, shown + 1));
        }}
      >
        <title id={titleId}>
          {`${label}: de ${formatEuros(points[0]!.eur)} el ${shortDate(points[0]!.date)} a ${formatEuros(points[last]!.eur)} el ${shortDate(points[last]!.date)}`}
        </title>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-text-3)"
            >
              {formatEuros(t)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--color-line-strong)"
          strokeWidth={1}
        />
        {[0, last].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize={11}
            fill="var(--color-text-3)"
          >
            {shortDate(points[i]!.date)}
          </text>
        ))}
        <path d={area} fill="var(--color-accent)" opacity={0.1} />
        <path
          d={line.join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active !== null && (
          <line
            x1={x(shown)}
            x2={x(shown)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--color-text-3)"
            strokeWidth={1}
          />
        )}
        <circle
          cx={x(shown)}
          cy={y(point.eur)}
          r={4.5}
          fill="var(--color-accent)"
          stroke="var(--color-panel)"
          strokeWidth={2}
        />
      </svg>
      <details className="text-xs">
        <summary className="subtle cursor-pointer">Ver los datos</summary>
        <div className="mt-1 overflow-auto" style={{ maxHeight: 180 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Día</th>
                <th className="r">Precio</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{shortDate(p.date)}</td>
                  <td className="r mono">{formatEuros(p.eur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** "+2,50 € (+25 %)" / "−1,00 € (−10 %)", con el signo tipográfico. */
export function formatChange(delta: number, percent: number | null) {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const pct = percent === null ? "" : ` (${sign}${Math.abs(percent).toLocaleString("es")} %)`;
  return `${sign}${formatEuros(Math.abs(delta))}${pct}`;
}
