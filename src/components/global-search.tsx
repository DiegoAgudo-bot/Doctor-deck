"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CardDTO, SavedDeckSummaryDTO, UserSummaryDTO } from "@/server/dto";
import { api } from "./api-client";
import { CardImage } from "./card-image";
import { IconDecks, IconSearch, IconUser, IconX } from "./icons";
import { readCached } from "./swr-cache";

interface Result {
  key: string;
  href: string;
  label: string;
  meta?: string | undefined;
  kind: "card" | "deck" | "user" | "all";
  card?: CardDTO | undefined;
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Cartas, mis mazos y gente que coinciden con el texto (lo pide con un pequeño retardo). */
function useResults(q: string, loggedIn: boolean): { results: Result[]; busy: boolean } {
  const [cards, setCards] = useState<CardDTO[]>([]);
  const [users, setUsers] = useState<UserSummaryDTO[]>([]);
  const [decks, setDecks] = useState<SavedDeckSummaryDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const term = q.trim();

  useEffect(() => {
    if (!loggedIn) return;
    // Mis mazos: los de la barra lateral (ya en el navegador) o, si no, se piden.
    const cached = readCached<SavedDeckSummaryDTO[]>("decks");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo guardado del navegador
    if (cached) setDecks(cached);
    else
      void api<SavedDeckSummaryDTO[]>("/api/decks", undefined, { silent: true })
        .then(setDecks)
        .catch(() => undefined);
  }, [loggedIn]);

  useEffect(() => {
    // Con menos de dos letras no se enseña nada (ver `results`).
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      setBusy(true);
      const qs = encodeURIComponent(term);
      Promise.all([
        api<CardDTO[]>(`/api/cards/search?q=${qs}&limit=6`, undefined, { silent: true }).catch(
          () => [],
        ),
        api<UserSummaryDTO[]>(`/api/users?q=${qs}`, undefined, { silent: true }).catch(() => []),
      ])
        .then(([c, u]) => {
          if (!alive) return;
          setCards(c);
          setUsers(u.slice(0, 4));
        })
        .finally(() => alive && setBusy(false));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);

  const results = useMemo((): Result[] => {
    if (term.length < 2) return [];
    const n = norm(term);
    const myDecks = decks
      .filter((d) => norm(d.name).includes(n) || d.commanderNames.some((c) => norm(c).includes(n)))
      .slice(0, 5);
    return [
      ...cards.map((c): Result => ({
        key: `c-${c.oracleId}`,
        href: `/cards/${c.oracleId}`,
        label: c.name,
        meta: c.typeLine,
        kind: "card",
        card: c,
      })),
      ...myDecks.map((d): Result => ({
        key: `d-${d.id}`,
        href: `/decks/${d.id}`,
        label: d.name,
        meta: d.commanderNames.join(" + "),
        kind: "deck",
      })),
      ...users.map((u): Result => ({
        key: `u-${u.username}`,
        href: `/u/${u.username}`,
        label: u.name,
        meta: `@${u.username}`,
        kind: "user",
      })),
      {
        key: "all",
        href: `/cards?q=${encodeURIComponent(term)}`,
        label: `Buscar «${term}» en todas las cartas`,
        kind: "all" as const,
      },
    ];
  }, [term, cards, decks, users]);

  return { results, busy };
}

const SECTION: Record<Result["kind"], string> = {
  card: "Cartas",
  deck: "Mis mazos",
  user: "Gente",
  all: "",
};

function ResultList({
  results,
  active,
  onPick,
  busy,
}: {
  results: Result[];
  active: number;
  onPick: (r: Result) => void;
  busy: boolean;
}) {
  return (
    <ul className="gsearch-list" role="listbox" aria-busy={busy}>
      {results.map((r, i) => (
        <li key={r.key} role="presentation">
          {(i === 0 || results[i - 1]?.kind !== r.kind) && SECTION[r.kind] && (
            <span className="cap gsearch-section">{SECTION[r.kind]}</span>
          )}
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            className={`gsearch-item ${i === active ? "is-active" : ""}`}
            // Antes que el blur del campo, que cerraría la lista.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(r)}
          >
            <span className="gsearch-icon">
              {r.kind === "card" && r.card ? (
                <CardImage card={r.card} sizes="24px" style={{ width: 24 }} />
              ) : r.kind === "deck" ? (
                <IconDecks size={15} />
              ) : r.kind === "user" ? (
                <IconUser size={15} />
              ) : (
                <IconSearch size={15} />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{r.label}</span>
              {r.meta && <span className="subtle truncate text-xs">{r.meta}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Buscador de la cabecera: cartas, mis mazos y gente. En el ordenador, un campo con la lista
 * debajo (atajo "/"); en el móvil, un botón que abre una hoja a pantalla completa.
 */
export function GlobalSearch({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const { results, busy } = useResults(q, loggedIn);

  // "/" en cualquier sitio (fuera de un campo) enfoca el buscador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!input.current || input.current.offsetParent === null) return;
      e.preventDefault();
      input.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = sheetRef.current;
    if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  function pick(r: Result) {
    setOpen(false);
    setSheet(false);
    setQ("");
    input.current?.blur();
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = results.length;
      if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) pick(r);
      else if (q.trim())
        pick({
          key: "all",
          href: `/cards?q=${encodeURIComponent(q.trim())}`,
          label: "",
          kind: "all",
        });
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  }

  const field = (autoFocus: boolean) => (
    <input
      ref={autoFocus ? undefined : input}
      className="input gsearch-input"
      type="search"
      placeholder="Buscar cartas, mazos o gente…"
      aria-label="Buscar en Doctor Deck"
      autoComplete="off"
      autoFocus={autoFocus}
      value={q}
      onChange={(e) => {
        setQ(e.target.value);
        setActive(0);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown}
    />
  );

  return (
    <>
      <div className="gsearch hide-sm">
        <IconSearch size={14} className="gsearch-glyph" />
        {field(false)}
        {!q && <kbd className="gsearch-kbd">/</kbd>}
        {open && results.length > 0 && (
          <div className="gsearch-pop panel">
            <ResultList results={results} active={active} onPick={pick} busy={busy} />
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-icon only-sm"
        aria-label="Buscar"
        onClick={() => setSheet(true)}
      >
        <IconSearch />
      </button>
      <dialog
        ref={sheetRef}
        className="dialog gsearch-sheet"
        aria-label="Buscar"
        onClose={() => setSheet(false)}
      >
        {sheet && (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              {field(true)}
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Cerrar"
                onClick={() => setSheet(false)}
              >
                <IconX size={14} />
              </button>
            </div>
            {results.length > 0 ? (
              <ResultList results={results} active={active} onPick={pick} busy={busy} />
            ) : (
              <p className="subtle px-1 text-[13px]">
                Escribe al menos dos letras: el nombre de una carta, de uno de tus mazos o de
                alguien.
              </p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
