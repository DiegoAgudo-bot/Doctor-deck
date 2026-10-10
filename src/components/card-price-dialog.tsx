"use client";

import { useEffect, useState } from "react";
import type { CardDTO, CardPricesDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardImage } from "./card-image";
import { formatChange, PriceChart } from "./price-chart";
import { Dialog, Loading } from "./ui";

const PERIODS = [
  [30, "30 días"],
  [90, "90 días"],
  [365, "1 año"],
] as const;

/** Histórico de precio de una carta (la impresión más barata de cada día). */
export function CardPriceDialog({ card, onClose }: { card: CardDTO | null; onClose: () => void }) {
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<CardPricesDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    api<CardPricesDTO>(`/api/cards/${encodeURIComponent(card.oracleId)}/prices?days=${days}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof ApiError ? e.message : "Error al cargar"),
      );
    return () => {
      cancelled = true;
    };
  }, [card, days]);

  const change = data?.change;
  return (
    <Dialog open={card !== null} onClose={onClose} title={card?.name ?? ""} width={620}>
      {card && (
        <div className="flex gap-4">
          <div className="hide-sm flex-none" style={{ width: 120 }}>
            <CardImage card={card} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
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
            {error ? (
              <p className="text-[13px]" style={{ color: "var(--color-out)" }}>
                {error}
              </p>
            ) : !data ? (
              <Loading>Cargando precios…</Loading>
            ) : (
              <div style={{ opacity: data ? 1 : 0.5 }}>
                <PriceChart points={data.history} label="Precio" />
                {change && change.delta !== null && (
                  <p className="mt-2 text-[13px]">
                    <span className="muted">En el periodo: </span>
                    <b className="mono">{formatChange(change.delta, change.percent)}</b>
                  </p>
                )}
              </div>
            )}
            <p className="subtle text-xs">
              Precio de tendencia de Cardmarket (vía Scryfall) de la impresión más barata. Se guarda
              cada noche para las cartas que hay en alguna colección o mazo.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
