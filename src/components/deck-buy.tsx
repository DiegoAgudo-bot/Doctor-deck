"use client";

import { useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { PurchasesDTO } from "@/server/dto";
import { CardHover } from "./card-image";
import { points, roleLabel } from "./deck-views";
import { ManaCost } from "./mana";
import { Loading } from "./ui";

export interface BuyOptions {
  maxCards: number;
  maxPrice?: number;
  budget?: number;
}

const cardmarketUrl = (name: string) =>
  `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Modo compra: qué cartas que no tengo (o tengo ocupadas) mejoran más el mazo, con presupuesto. */
export function BuyPanel({
  purchases,
  options,
  onSearch,
  busy,
}: {
  purchases: PurchasesDTO | null;
  options: BuyOptions | null;
  onSearch: (opts: BuyOptions) => void;
  busy: boolean;
}) {
  const [maxCards, setMaxCards] = useState(String(options?.maxCards ?? 5));
  const [maxPrice, setMaxPrice] = useState(options?.maxPrice?.toString().replace(".", ",") ?? "2");
  const [budget, setBudget] = useState(options?.budget?.toString().replace(".", ",") ?? "");
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const items = purchases?.items ?? [];
  const chosen = items.filter((p) => !off.has(p.id));
  const total = chosen.reduce((n, p) => n + (p.in.price ?? 0), 0);
  const gain = points(chosen.reduce((n, p) => n + p.score, 0));
  const limit = options?.budget;

  async function copy() {
    const text = chosen.map((p) => `1 ${p.in.card.name.split(" // ")[0]}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="muted text-[13px]">
        ¿Qué cartas que no tienes (o tienes ocupadas en otros mazos) mejorarían más el mazo? Precio
        de tendencia de Cardmarket según Scryfall (la impresión más barata).
      </p>
      <form
        className="panel grid-1-sm grid items-end gap-3 p-3"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto" }}
        onSubmit={(e) => {
          e.preventDefault();
          const mp = num(maxPrice);
          const b = num(budget);
          setOff(new Set());
          onSearch({
            maxCards: Math.min(30, Math.max(1, Math.round(num(maxCards) ?? 5))),
            ...(mp !== undefined ? { maxPrice: mp } : {}),
            ...(b !== undefined ? { budget: b } : {}),
          });
        }}
      >
        <div className="field">
          <label className="label" htmlFor="buy-n">
            Máx. cartas
          </label>
          <input
            id="buy-n"
            className="input mono"
            inputMode="numeric"
            value={maxCards}
            onChange={(e) => setMaxCards(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="buy-pm">
            Máx. por carta (€)
          </label>
          <input
            id="buy-pm"
            className="input mono"
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="buy-pt">
            Presupuesto total (€)
          </label>
          <input
            id="buy-pt"
            className="input mono"
            inputMode="decimal"
            placeholder="sin límite"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: 34 }} disabled={busy}>
          Buscar compras
        </button>
      </form>

      {busy && <Loading>Buscando las compras que más mejoran el mazo…</Loading>}

      {purchases && !busy && (
        <section className="panel">
          <div className="panel-h stack-sm py-2">
            <span className="h2">
              {chosen.length} cartas · <span className="mono">{formatEuros(total)}</span>
              {limit !== undefined && (
                <span className="subtle" style={{ fontWeight: 400 }}>
                  {" "}
                  de {formatEuros(limit)}
                </span>
              )}
            </span>
            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="score">+{gain} pts</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void copy()}
                  disabled={chosen.length === 0}
                >
                  {copied ? "¡Copiado!" : "Copiar para Cardmarket"}
                </button>
              </div>
            )}
          </div>
          {limit !== undefined && (
            <div className="px-3">
              <div className="role-bar" style={{ height: 4, margin: "10px 0" }}>
                <i
                  style={{
                    width: "100%",
                    transform: `scaleX(${Math.min(1, total / limit)})`,
                    transition: "transform var(--motion-300) var(--ease-out)",
                    background: "var(--color-accent)",
                    animation: "none",
                  }}
                />
              </div>
            </div>
          )}
          {items.length === 0 ? (
            <p className="muted p-3 text-[13px]">
              Ninguna compra mejora el mazo con esos límites ({purchases.candidateCount} cartas
              cumplían el precio).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Entra</th>
                    <th className="hide-sm">Sale</th>
                    <th className="hide-sm">Rol</th>
                    <th className="r hide-sm">Mejora</th>
                    <th className="r">Precio</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const on = !off.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        style={{
                          opacity: on ? 1 : 0.45,
                          transition: "opacity var(--motion-150) var(--ease-out)",
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={on}
                            aria-label={`Incluir ${p.in.card.name}`}
                            style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                            onChange={() =>
                              setOff((prev) => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td>
                          <CardHover card={p.in.card} className="inline-flex items-center gap-2">
                            <span className="mono" style={{ color: "var(--color-in)" }}>
                              +
                            </span>
                            <span style={{ fontWeight: 500 }}>{p.in.card.name}</span>
                            <ManaCost cost={p.in.card.manaCost} />
                          </CardHover>
                        </td>
                        <td className="hide-sm">
                          <span
                            className="muted"
                            style={{
                              textDecoration: "line-through",
                              textDecorationColor: "var(--color-out)",
                            }}
                          >
                            {p.out.card.name}
                          </span>
                        </td>
                        <td className="hide-sm">
                          <span className="pill">{roleLabel(p.in.primaryRole)}</span>
                        </td>
                        <td className="r mono hide-sm">+{points(p.score)}</td>
                        <td className="r mono">
                          {p.in.price !== undefined ? formatEuros(p.in.price) : "—"}
                        </td>
                        <td className="r">
                          <a
                            className="btn btn-ghost btn-sm"
                            href={cardmarketUrl(p.in.card.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ver ${p.in.card.name} en Cardmarket`}
                          >
                            Cardmarket ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
