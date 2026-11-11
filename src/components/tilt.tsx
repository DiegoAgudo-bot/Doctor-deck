"use client";

import { useRef, type ReactNode } from "react";

/**
 * La carta se inclina hacia el puntero, como al cogerla para mirarla (solo con ratón; con
 * «reducir movimiento» no hace nada). La inclinación va en variables CSS: el brillo de `.tilt`
 * sigue al puntero con las mismas.
 */
export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = () =>
    typeof window === "undefined" ||
    !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;

  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || still()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
        el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
        el.dataset.active = "1";
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
        delete el.dataset.active;
      }}
    >
      {children}
    </div>
  );
}
