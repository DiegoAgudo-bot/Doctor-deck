"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, OwnershipDTO, OwnershipItemDTO } from "@/server/dto";
import { CardHover } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { ManaCost } from "./mana";
import { Banner, fmt } from "./ui";

const cardmarketUrl = (name: string) =>
  `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

/** Lista de compra en el formato "1 Nombre" que admiten Cardmarket (Wants) y casi todas las webs. */
export function shoppingList(items: readonly OwnershipItemDTO[]): string {
  return items
    .filter((i) => i.toBuy > 0)
    .map((i) => `${i.toBuy} ${i.card.name.split(" // ")[0] ?? i.card.name}`)
    .join("\n");
}

function Stat({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string | undefined;
  tone?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <span className="cap">{label}</span>
      <span className="mono" style={{ fontSize: 22, fontWeight: 500, color: tone }}>
        {value}
      </span>
      {meta && <span className="subtle text-xs">{meta}</span>}
    </div>
  );
}

function CardName({ item }: { item: OwnershipItemDTO }) {
  return (
    <CardHover card={item.card} className="inline-flex items-center gap-2">
      {item.card.name}
      {item.isCommander && <span className="pill subtle">comandante</span>}
      <ManaCost cost={item.card.manaCost} />
    </CardHover>
  );
}

/**
 * Pestaña "Qué me falta": el mazo frente a mi colección. Lo que tengo, lo que tendría que sacar de
 * otros mazos y lo que me falta comprar (con precio, lista para Cardmarket y enlaces).
 */
export function OwnershipPanel({
  ownership,
  hasCollection,
  loggedIn,
  wishlist,
}: {
  ownership: OwnershipDTO;
  hasCollection: boolean;
  loggedIn: boolean;
  /** En mis mazos guardados: si lo que falta entra en mi lista de deseos, y cambiarlo. */
  wishlist?: { on: boolean; busy: boolean; onToggle: () => void } | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const [priceCard, setPriceCard] = useState<CardDTO | null>(null);
  const { items, totals } = ownership;
  const missing = items
    .filter((i) => i.status === "missing")
    .sort((a, b) => (b.price ?? -1) * b.toBuy - (a.price ?? -1) * a.toBuy);
  const elsewhere = items.filter((i) => i.status === "in_other_decks");
  const have = items.filter((i) => i.status === "owned");
  const pct = totals.cards ? Math.round((totals.have / totals.cards) * 100) : 0;
  const unpriced = missing.filter((i) => i.price === null).length;
  const list = shoppingList(missing);

  async function copy() {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([list], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-de-compra.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {!hasCollection && (
        <Banner
          tone="warn"
          action={
            <Link className="btn btn-sm" href="/coleccion">
              Importar colección
            </Link>
          }
        >
          <b>No sé qué cartas tienes.</b>{" "}
          <span className="muted">
            Importa tu colección de ManaBox para ver qué te falta de verdad.
          </span>
        </Banner>
      )}

      <section className="panel">
        <div
          className="grid-1-sm grid"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <Stat
            label="Ya las tienes"
            value={`${fmt(totals.have)} / ${fmt(totals.cards)}`}
            meta={`${pct} % del mazo, sin contar básicas`}
            tone="var(--color-in)"
          />
          <Stat
            label="En otros de tus mazos"
            value={fmt(totals.fromOtherDecks)}
            meta={totals.fromOtherDecks ? "Las tienes, pero las estás usando" : "Ninguna ocupada"}
            tone={totals.fromOtherDecks ? "var(--color-inuse)" : undefined}
          />
          <Stat
            label="Te faltan"
            value={fmt(totals.toBuy)}
            meta={
              totals.toBuy
                ? `≈ ${formatEuros(totals.cost)}${unpriced ? ` (+${unpriced} sin precio)` : ""}`
                : "¡Puedes montarlo ya!"
            }
            tone={totals.toBuy ? "var(--color-out)" : "var(--color-in)"}
          />
        </div>
        <div className="px-4 pb-3.5">
          <div className="role-bar" style={{ height: 6 }}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {missing.length > 0 && (
        <section className="panel">
          <div className="panel-h stack-sm py-2">
            <span className="h2">
              Para comprar{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {fmt(totals.toBuy)} · ≈ {formatEuros(totals.cost)}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {wishlist && (
                <button
                  type="button"
                  className={`btn ${wishlist.on ? "is-on" : ""}`}
                  aria-pressed={wishlist.on}
                  disabled={wishlist.busy}
                  title="Lo que falta entra en tu lista de deseos y se cruza con otros jugadores"
                  onClick={wishlist.onToggle}
                >
                  {wishlist.on ? "En tu lista de deseos ✓" : "Añadir a mi lista de deseos"}
                </button>
              )}
              <button type="button" className="btn" onClick={download}>
                Descargar .txt
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                {copied ? "¡Copiada!" : "Copiar lista para Cardmarket"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="r" style={{ width: 56 }}>
                    Faltan
                  </th>
                  <th>Carta</th>
                  <th className="r hide-sm">Tienes</th>
                  <th className="r">Precio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {missing.map((i) => (
                  <tr key={i.card.oracleId}>
                    <td className="r mono">{i.toBuy}</td>
                    <td>
                      <CardName item={i} />
                    </td>
                    <td className="r mono subtle hide-sm">{i.owned || "—"}</td>
                    <td className="r mono">
                      {i.price !== null ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title="Ver el histórico de precio"
                          onClick={() => setPriceCard(i.card)}
                        >
                          {formatEuros(i.price * i.toBuy)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="r">
                      <a
                        className="btn btn-ghost btn-sm"
                        href={cardmarketUrl(i.card.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buscar ${i.card.name} en Cardmarket`}
                      >
                        Cardmarket ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle px-3 py-2 text-xs">
            Precio de tendencia de Cardmarket de la impresión más barata (según Scryfall). En
            Cardmarket: Wants › Añadir lista › pega la lista.
          </p>
        </section>
      )}

      {elsewhere.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <span className="h2">
              Las tienes en otros mazos{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {fmt(totals.fromOtherDecks)}
              </span>
            </span>
            <span className="subtle text-xs">Muévelas o compra otra copia</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {elsewhere.map((i) => (
                  <tr key={i.card.oracleId}>
                    <td className="r mono" style={{ width: 56 }}>
                      {i.fromOtherDecks}
                    </td>
                    <td>
                      <CardName item={i} />
                    </td>
                    <td className="muted">
                      <span className="flex items-center gap-1.5">
                        <span className="dot dot-inuse" />
                        {i.usedIn.join(", ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {have.length > 0 && (
        <details className="issues">
          <summary>
            <span className="dot dot-owned" />
            <span>
              <b>Ya las tienes libres</b>{" "}
              <span className="muted">— {fmt(have.reduce((n, i) => n + i.needed, 0))} copias</span>
            </span>
          </summary>
          <ul style={{ listStyle: "none", paddingLeft: 12 }}>
            {have.map((i) => (
              <li key={i.card.oracleId}>
                <span className="mono subtle">{i.needed}</span> <CardName item={i} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {!loggedIn && (
        <p className="subtle text-xs">
          Sin cuenta no se descuentan las cartas de otros mazos (no tienes mazos guardados).
        </p>
      )}
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
    </div>
  );
}
