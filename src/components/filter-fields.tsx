"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

/** Piezas de los filtros avanzados (colección y buscador de cartas), como los de ManaBox. */

/** Un grupo de filtros con su título. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filtergroup" role="group" aria-label={label}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** Varias opciones a la vez (sin ninguna = todas). */
export function ChipSet<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div className="chips">
      {options.map(([key, label]) => {
        const on = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            className={`chipbtn ${on ? "is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== key) : [...value, key])}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Una sola opción (o ninguna, volviendo a pulsar la elegida). */
export function ChipChoice<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="chips">
      {options.map(([key, label]) => (
        <button
          key={String(key)}
          type="button"
          className={`chipbtn ${value === key ? "is-on" : ""}`}
          aria-pressed={value === key}
          onClick={() => onChange(value === key ? null : key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "5" / "0,5" → número; vacío o no válido → null. */
export const parseNumber = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

/** Un campo que se aplica al dejar de escribir (medio segundo). */
function DebouncedInput<T>({
  value,
  onChange,
  toText,
  fromText,
  ...props
}: {
  value: T;
  onChange: (v: T) => void;
  toText: (v: T) => string;
  fromText: (s: string) => T;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(toText(value));
  /** Lo último que se sabe que está aplicado: solo se avisa si lo escrito es otra cosa. */
  const applied = useRef(draft);
  const latest = useRef({ onChange, fromText });
  useEffect(() => {
    latest.current = { onChange, fromText };
  });
  useEffect(() => {
    applied.current = toText(value);
    setDraft(applied.current);
  }, [value, toText]);
  useEffect(() => {
    if (draft === applied.current) return;
    const t = setTimeout(() => {
      applied.current = draft;
      latest.current.onChange(latest.current.fromText(draft));
    }, 500);
    return () => clearTimeout(t);
  }, [draft]);
  return <input {...props} value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

const numText = (v: number | null) => (v === null ? "" : String(v));

/** Un rango «desde – hasta» (los dos opcionales). */
export function RangeFields({
  label,
  min,
  max,
  onChange,
  unit,
}: {
  label: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  /** "€", por ejemplo. */
  unit?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <DebouncedInput
        className="input"
        style={{ width: 84 }}
        inputMode="decimal"
        placeholder={unit ? `mín. ${unit}` : "mín."}
        aria-label={`${label}: desde`}
        value={min}
        toText={numText}
        fromText={parseNumber}
        onChange={(v) => onChange(v, max)}
      />
      <span className="subtle">–</span>
      <DebouncedInput
        className="input"
        style={{ width: 84 }}
        inputMode="decimal"
        placeholder={unit ? `máx. ${unit}` : "máx."}
        aria-label={`${label}: hasta`}
        value={max}
        toText={numText}
        fromText={parseNumber}
        onChange={(v) => onChange(min, v)}
      />
    </span>
  );
}

const same = (s: string) => s;

/** Texto libre que se aplica al dejar de escribir. */
export function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <DebouncedInput
      className="input"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      toText={same}
      fromText={same}
      onChange={onChange}
    />
  );
}
