"use client";

import { useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, CollectionPricesDTO, PriceMoverDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { formatChange, PriceChart } from "./price-chart";
import { Banner, EmptyState, Loading } from "./ui";

const PERIODS = [
  [7, "7 días"],
  [30, "30 días"],
  [90, "90 días"],
  [365, "1 año"],
] as const;

function Movers({
  title,
  items,
  onOpen,
  empty,
}: {
  title: string;
  items: PriceMoverDTO[];
  onOpen: (card: CardDTO) => void;
  empty: string;
}) {
  return (
    <section className="panel">
      <div className="panel-h">
        <span className="h2">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="subtle p-3 text-[13px]">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <tbody>
              {items.map((m) => (
                <tr key={m.card.oracleId}>
                  <td style={{ maxWidth: 0, width: "100%" }}>
                    <span className="block truncate">
                      <CardHover card={m.card}>{m.card.name}</CardHover>
                      {m.copies > 1 && <span className="subtle"> ×{m.copies}</span>}
                    </span>
                    <span className="mono subtle block text-xs">
                      {formatEuros(m.before)} → {formatEuros(m.now)}
                    </span>
                  </td>
                  <td className="r mono whitespace-nowrap">
                    <button
                      type="button"
                      className="linkbtn"
                      title="Ver el histórico de precio"
                      onClick={() => onOpen(m.card)}
                    >
                      {formatChange(m.valueDelta, m.percent)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Pestaña "Precios" de la colección: su valor día a día y las cartas que más han subido y bajado
 * (por lo que cambia el valor de tus copias), con el histórico que se guarda cada noche.
 */
export function CollectionPrices({
  loggedIn,
  localPairs,
}: {
  loggedIn: boolean;
  localPairs: [string, number][] | null;
}) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<CollectionPricesDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceCard, setPriceCard] = useState<CardDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar el periodo
    setLoading(true);
    api<CollectionPricesDTO>("/api/collection/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days,
        ...(loggedIn || !localPairs ? {} : { collection: localPairs }),
      }),
    })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof ApiError ? e.message : "Error al cargar"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days, loggedIn, localPairs]);

  if (error) return <Banner tone="out">{error}</Banner>;
  if (!data) return <Loading>Cargando precios…</Loading>;
  if (!data.latest) {
    return (
      <div className="panel">
        <EmptyState title="Todavía no hay histórico de precios">
          Cada noche se guarda el precio de las cartas de las colecciones y los mazos. Vuelve
          mañana.
        </EmptyState>
      </div>
    );
  }

  const first = data.value[0];
  const last = data.value.at(-1);
  return (
    // Al cambiar de periodo se queda lo anterior, más tenue, hasta que llegan los datos.
    <div className="flex flex-col gap-4" style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="chips" role="radiogroup" aria-label="Periodo">
        {PERIODS.map(([d, label]) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            className={`chipbtn ${days === d ? "is-on" : ""}`}
            onClick={() => setDays(d)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-h">
          <span className="h2">Valor de la colección</span>
          {first && last && first.date !== last.date && (
            <span className="mono text-[13px]">
              {formatChange(
                Math.round((last.eur - first.eur) * 100) / 100,
                first.eur > 0 ? Math.round(((last.eur - first.eur) / first.eur) * 1000) / 10 : null,
              )}
            </span>
          )}
        </div>
        <div className="p-3">
          <PriceChart points={data.value} label="Valor de la colección" />
        </div>
      </section>

      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <Movers
          title="Lo que más sube"
          items={data.up}
          onOpen={setPriceCard}
          empty="Nada ha subido en este periodo (o aún no hay dos días de precios)."
        />
        <Movers
          title="Lo que más baja"
          items={data.down}
          onOpen={setPriceCard}
          empty="Nada ha bajado en este periodo (o aún no hay dos días de precios)."
        />
      </div>
      <p className="subtle text-xs">
        Precio de tendencia de Cardmarket (vía Scryfall) de la impresión más barata de cada carta,
        guardado cada noche (hay datos desde el {first?.date ?? data.latest}). Ordenado por lo que
        cambia el valor de tus copias.
      </p>
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
    </div>
  );
}
