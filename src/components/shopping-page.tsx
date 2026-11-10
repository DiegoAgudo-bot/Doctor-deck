"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/domain/i18n/locale";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, ShoppingListDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { ManaCost } from "./mana";
import { Banner, EmptyState, fmt, Loading } from "./ui";
import { Link, useLocale, useT } from "@/components/i18n";

const shopUrl = (name: string, locale: Locale) =>
  `https://www.cardmarket.com/${locale}/Magic/Products/Search?searchString=${encodeURIComponent(name.split(" // ")[0] ?? name)}`;

/**
 * Lista de la compra de todos mis mazos: lo que falta para tenerlos montados a la vez (si dos
 * comparten una carta y solo tengo una copia, falta una), con filtro por mazo, coste y la lista
 * en texto para copiar o descargar.
 */
export function ShoppingPage() {
  const t = useT();
  const locale = useLocale();
  const eur = (x: number) => formatEuros(x, locale);
  const [data, setData] = useState<ShoppingListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState("");
  const [copied, setCopied] = useState(false);
  const [priceCard, setPriceCard] = useState<CardDTO | null>(null);

  useEffect(() => {
    let alive = true;
    api<ShoppingListDTO>("/api/me/shopping")
      .then((d) => alive && setData(d))
      .catch(
        (e) =>
          alive &&
          setError(
            e instanceof ApiError
              ? e.message
              : t("No se pudo cargar la lista de compra", "Couldn't load the shopping list"),
          ),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide una vez
  }, []);

  const items = useMemo(
    () => (data?.items ?? []).filter((i) => !deck || i.decks.some((d) => d.id === deck)),
    [data, deck],
  );
  const copies = items.reduce((n, i) => n + i.quantity, 0);
  const cost = items.reduce((n, i) => n + (i.price ?? 0) * i.quantity, 0);
  const unpriced = items.filter((i) => i.price === null).length;
  // Solo los mazos a los que les falta algo.
  const decks = useMemo(() => {
    const withMissing = new Set((data?.items ?? []).flatMap((i) => i.decks.map((d) => d.id)));
    return (data?.decks ?? []).filter((d) => withMissing.has(d.id));
  }, [data]);
  const list = items
    .map((i) => `${i.quantity} ${i.card.name.split(" // ")[0] ?? i.card.name}`)
    .join("\n");

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
    a.download = t("lista-de-compra.txt", "shopping-list.txt");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <div className="stack-sm flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="h1">{t("Lista de compra", "Shopping list")}</h1>
          <p className="muted text-[13px]">
            {t(
              "Lo que te falta para tener todos tus mazos montados a la vez. Si dos mazos comparten una carta y solo tienes una copia, falta una.",
              "What you're missing to have all your decks built at once. If two decks share a card and you only own one copy, one is missing.",
            )}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={download}>
              {t("Descargar .txt", "Download .txt")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void copy()}>
              {copied ? t("¡Copiada!", "Copied!") : t("Copiar lista", "Copy list")}
            </button>
          </div>
        )}
      </div>
      {error && <Banner tone="out">{error}</Banner>}
      {!data && !error && (
        <Loading>{t("Mirando qué falta en tus mazos…", "Checking what your decks need…")}</Loading>
      )}
      {data && data.decks.length === 0 && (
        <section className="panel">
          <EmptyState
            title={t("Aún no tienes mazos", "You don't have any decks yet")}
            action={
              <Link className="btn btn-primary" href="/decks/new">
                {t("Crear un mazo", "Create a deck")}
              </Link>
            }
          >
            {t(
              "Guarda un mazo y aquí verás qué cartas te faltan para montarlo.",
              "Save a deck and you'll see here which cards you're missing to build it.",
            )}
          </EmptyState>
        </section>
      )}
      {data && data.decks.length > 0 && data.items.length === 0 && (
        <section className="panel">
          <EmptyState title={t("No te falta nada", "Nothing missing")}>
            {t(
              "Tienes todas las cartas de todos tus mazos. Puedes montarlos a la vez.",
              "You own every card in all your decks. You can build them all at once.",
            )}
          </EmptyState>
        </section>
      )}
      {data && data.items.length > 0 && (
        <section className="panel">
          <div className="panel-h stack-sm py-2">
            <span className="h2">
              {t("Para comprar", "To buy")}{" "}
              <span className="mono subtle" style={{ fontWeight: 400 }}>
                {fmt(copies, locale)} · ≈ {eur(cost)}
                {unpriced > 0 && t(` (+${unpriced} sin precio)`, ` (+${unpriced} unpriced)`)}
              </span>
            </span>
            {decks.length > 1 && (
              <label className="flex items-center gap-2 text-[13px]">
                <span className="muted">{t("Mazo", "Deck")}</span>
                <select className="select" value={deck} onChange={(e) => setDeck(e.target.value)}>
                  <option value="">{t("Todos mis mazos", "All my decks")}</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="table rtable">
              <thead>
                <tr>
                  <th className="r" style={{ width: 56 }}>
                    {t("Faltan", "Need")}
                  </th>
                  <th>{t("Carta", "Card")}</th>
                  <th>{t("Para", "For")}</th>
                  <th className="r">{t("Precio", "Price")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.card.oracleId}>
                    <td className="r mono rt-qty">{i.quantity}</td>
                    <td className="rt-main">
                      <CardHover card={i.card} className="inline-flex items-center gap-2">
                        <Link
                          href={`/cards/${i.card.oracleId}`}
                          style={{ color: "var(--color-text)" }}
                        >
                          {i.card.name}
                        </Link>
                        <ManaCost cost={i.card.manaCost} />
                      </CardHover>
                    </td>
                    <td className="muted text-[12.5px]">
                      {i.decks.map((d, n) => (
                        <span key={d.id}>
                          <Link href={`/decks/${d.id}?tab=missing`}>{d.name}</Link>
                          {n < i.decks.length - 1 && ", "}
                        </span>
                      ))}
                    </td>
                    <td className="r mono rt-end">
                      {i.price !== null ? (
                        <button
                          type="button"
                          className="linkbtn"
                          title={t("Ver el histórico de precio", "See the price history")}
                          onClick={() => setPriceCard(i.card)}
                        >
                          {eur(i.price * i.quantity)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="r">
                      <a
                        className="btn btn-ghost btn-sm"
                        href={shopUrl(i.card.name, locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t(`Comprar ${i.card.name}`, `Buy ${i.card.name}`)}
                      >
                        {t("Comprar ↗", "Buy ↗")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle px-3 py-2 text-xs">
            {t(
              "Precio de referencia del mercado europeo de la impresión más barata.",
              "European market reference price of the cheapest printing.",
            )}
          </p>
        </section>
      )}
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
    </main>
  );
}
