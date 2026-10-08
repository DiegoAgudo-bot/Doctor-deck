"use client";

import { useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { PurchasesDTO, ScoredCardDTO } from "@/server/dto";
import { CardImage } from "./card-image";
import { Section, buttonClass } from "./ui";

/** Guardar el mazo (nuevo o actualizar el abierto). */
export function SaveDeckBar({
  deckId,
  name,
  onName,
  onSave,
  busy,
  message,
}: {
  deckId: number | null;
  name: string;
  onName: (name: string) => void;
  onSave: (asNew: boolean) => void;
  busy: boolean;
  message: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <label className="flex flex-col gap-1 text-sm">
        <span>Nombre del mazo</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Por defecto, el nombre del comandante"
          maxLength={120}
          className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(false)}
          className={buttonClass.primary}
        >
          {deckId ? "Guardar cambios" : "Guardar en mis mazos"}
        </button>
        {deckId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(true)}
            className={buttonClass.secondary}
          >
            Guardar como nuevo
          </button>
        )}
        {message && (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">{message}</span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Las cartas de tus mazos guardados se descuentan de las copias disponibles al analizar otros
        mazos.
      </p>
    </div>
  );
}

/** Recomendadas que tengo pero con todas las copias ocupadas en otros mazos. */
export function UnavailableList({ cards }: { cards: ScoredCardDTO[] }) {
  if (cards.length === 0) return null;
  return (
    <details className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer">
        {cards.length === 1
          ? "1 recomendada que tienes pero usas en otros mazos"
          : `${cards.length} recomendadas que tienes pero usas en otros mazos`}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {cards.map((c) => (
          <li key={c.card.oracleId}>
            {c.card.name} <span className="text-zinc-500">— en {c.usedIn?.join(", ")}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export interface BuyOptions {
  maxCards: number;
  maxPrice?: number;
  budget?: number;
}

const cardmarketUrl = (name: string) =>
  `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

/** Modo "si compro N cartas baratas, ¿cuáles mejoran más el mazo?". */
export function BuyPanel({
  purchases,
  onSearch,
  busy,
}: {
  purchases: PurchasesDTO | null;
  onSearch: (opts: BuyOptions) => void;
  busy: boolean;
}) {
  const [maxCards, setMaxCards] = useState("5");
  const [maxPrice, setMaxPrice] = useState("1");
  const [budget, setBudget] = useState("");
  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return (
    <Section title="Comprar cartas baratas">
      <p className="text-sm text-zinc-500">
        ¿Qué cartas que no tienes (o tienes ocupadas en otros mazos) mejorarían más el mazo? Precio
        de referencia de Cardmarket según Scryfall (la impresión más barata).
      </p>
      <form
        className="grid grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const mp = num(maxPrice);
          const b = num(budget);
          onSearch({
            maxCards: Math.min(30, Math.max(1, Math.round(num(maxCards) ?? 5))),
            ...(mp !== undefined ? { maxPrice: mp } : {}),
            ...(b !== undefined ? { budget: b } : {}),
          });
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          Nº de cartas
          <input
            inputMode="numeric"
            value={maxCards}
            onChange={(e) => setMaxCards(e.target.value)}
            className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Máx. por carta (€)
          <input
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Presupuesto (€)
          <input
            inputMode="decimal"
            value={budget}
            placeholder="sin límite"
            onChange={(e) => setBudget(e.target.value)}
            className="rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <div className="col-span-3">
          <button type="submit" disabled={busy} className={buttonClass.primary}>
            {busy ? "Buscando…" : "Buscar compras"}
          </button>
        </div>
      </form>

      {purchases &&
        (purchases.items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ninguna compra mejora el mazo con esos límites ({purchases.candidateCount} cartas
            cumplían el precio).
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {purchases.items.length} cartas · total aprox. {formatEuros(purchases.totalCost)}
            </p>
            <ul className="flex flex-col gap-3">
              {purchases.items.map((p) => (
                <li
                  key={p.id}
                  className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <CardImage card={p.in.card} className="w-20 shrink-0 sm:w-24" />
                  <div className="flex min-w-0 flex-col gap-1 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{p.in.card.name}</span>
                      <span className="tabular-nums">
                        {p.in.price !== undefined ? formatEuros(p.in.price) : "—"}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">en lugar de {p.out.card.name}</span>
                    <p>{p.reason}</p>
                    <a
                      href={cardmarketUrl(p.in.card.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-700 underline dark:text-sky-400"
                    >
                      Buscar en Cardmarket
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ))}
    </Section>
  );
}
