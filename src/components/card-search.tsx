"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import type { CardDTO } from "@/server/dto";
import { api } from "./api-client";
import { CardImage } from "./card-image";
import { ManaCost } from "./mana";

/**
 * Buscador de cartas con autocompletado (flechas, Enter, Escape). Al elegir una carta llama a
 * `onPick`; con `clearOnPick` vacía el texto (para ir añadiendo varias), si no deja el nombre.
 * `filters`: `commander` (solo las que pueden ser comandante) e `identity` ("WR"…: solo las que
 * caben en esos colores).
 */
export function CardSearch({
  id,
  label,
  placeholder = "Escribe el nombre (en inglés)…",
  filters,
  onPick,
  onType,
  clearOnPick = false,
  autoFocus = false,
  inputRef,
}: {
  id: string;
  label: string;
  placeholder?: string;
  filters?: { commander?: boolean; identity?: string } | undefined;
  onPick: (card: CardDTO) => void;
  /** Al escribir (p. ej. para olvidar la carta elegida antes). */
  onType?: (() => void) | undefined;
  clearOnPick?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement> | undefined;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extra = `${filters?.commander ? "&commander=1" : ""}${
    filters?.identity !== undefined
      ? `&identity=${encodeURIComponent(filters.identity || "C")}`
      : ""
  }`;

  // Con un pequeño retardo; se descartan respuestas de búsquedas anteriores.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === picked) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api<CardDTO[]>(`/api/cards/search?q=${encodeURIComponent(q)}&limit=8${extra}`)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setActive(0);
          setOpen(true);
        })
        .catch(() => !cancelled && setResults([]));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, picked, extra]);

  // Con menos de 2 letras no se busca: lo que quedara de antes no se enseña.
  const suggestions = query.trim().length >= 2 ? results : [];
  const showList = open && suggestions.length > 0;

  function choose(card: CardDTO) {
    setOpen(false);
    if (clearOnPick) {
      setQuery("");
      setPicked(null);
    } else {
      setQuery(card.name);
      setPicked(card.name);
    }
    onPick(card);
  }

  return (
    <div className="field relative">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        className="input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
          onType?.();
        }}
        onFocus={() => suggestions.length > 0 && picked === null && setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const r = suggestions[active];
            if (r) choose(r);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="dialog absolute top-full right-0 left-0 z-40 mt-1 max-h-[340px] overflow-auto p-1"
          style={{ width: "auto", animation: "none" }}
        >
          {suggestions.map((c, i) => (
            <li
              key={c.oracleId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5"
              style={{ background: i === active ? "var(--color-hover)" : undefined }}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
            >
              <CardImage card={c} style={{ width: 28 }} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate" style={{ fontWeight: 500 }}>
                  {c.name}
                </span>
                <span className="subtle truncate text-xs">{c.typeLine}</span>
              </span>
              <ManaCost cost={c.manaCost} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
