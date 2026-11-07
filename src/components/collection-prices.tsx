"use client";

import { useEffect, useState } from "react";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDTO, CollectionPricesDTO, PriceMoverDTO } from "@/server/dto";
import { api, ApiError } from "./api-client";
import { CardHover } from "./card-image";
import { CardPriceDialog } from "./card-price-dialog";
import { formatChange, PriceChart } from "./price-chart";
import { Banner, EmptyState, Loading } from "./ui";
import { useLocale, useT } from "./i18n";

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
  const t = useT();
  const locale = useLocale();
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
                      {m.card.printing && (
                        <span className="mono subtle text-xs">
                          {" "}
                          {m.card.printing.setCode.toUpperCase()}
                          {m.foil ? " foil" : ""}
                        </span>
                      )}
                      {m.copies > 1 && <span className="subtle"> ×{m.copies}</span>}
                    </span>
                    <span className="mono subtle block text-xs">
                      {formatEuros(m.before, locale)} → {formatEuros(m.now, locale)}
                    </span>
                  </td>
                  <td className="r mono whitespace-nowrap">
                    <button
                      type="button"
                      className="linkbtn"
                      title={t("Ver el histórico de precio", "See the price history")}
                      onClick={() => onOpen(m.card)}
                    >
                      {formatChange(m.valueDelta, m.percent, locale)}
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
  const t = useT();
  const locale = useLocale();
  const PERIODS = [
    [7, t("7 días", "7 days")],
    [30, t("30 días", "30 days")],
    [90, t("90 días", "90 days")],
    [365, t("1 año", "1 year")],
  ] as const;
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
          !cancelled &&
          setError(e instanceof ApiError ? e.message : t("Error al cargar", "Couldn't load")),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t solo cambia con el idioma (recarga)
  }, [days, loggedIn, localPairs]);

  if (error) return <Banner tone="out">{error}</Banner>;
  if (!data) return <Loading>{t("Cargando precios…", "Loading prices…")}</Loading>;
  if (!data.latest) {
    return (
      <div className="panel">
        <EmptyState title={t("Todavía no hay histórico de precios", "No price history yet")}>
          {t(
            "Cada noche se guarda el precio de las cartas de las colecciones y los mazos. Vuelve mañana.",
            "Every night the price of the cards in collections and decks is saved. Come back tomorrow.",
          )}
        </EmptyState>
      </div>
    );
  }

  const first = data.value[0];
  const last = data.value.at(-1);
  return (
    // Al cambiar de periodo se queda lo anterior, más tenue, hasta que llegan los datos.
    <div className="flex flex-col gap-4" style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="chips" role="radiogroup" aria-label={t("Periodo", "Period")}>
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
          <span className="h2">{t("Valor de la colección", "Collection value")}</span>
          {first && last && first.date !== last.date && (
            <span className="mono text-[13px]">
              {formatChange(
                Math.round((last.eur - first.eur) * 100) / 100,
                first.eur > 0 ? Math.round(((last.eur - first.eur) / first.eur) * 1000) / 10 : null,
                locale,
              )}
            </span>
          )}
        </div>
        <div className="p-3">
          <PriceChart points={data.value} label={t("Valor de la colección", "Collection value")} />
        </div>
      </section>

      <div
        className="grid-1-sm grid items-start gap-4"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <Movers
          title={t("Lo que más sube", "Biggest gainers")}
          items={data.up}
          onOpen={setPriceCard}
          empty={t(
            "Nada ha subido en este periodo (o aún no hay dos días de precios).",
            "Nothing went up in this period (or there aren't two days of prices yet).",
          )}
        />
        <Movers
          title={t("Lo que más baja", "Biggest losers")}
          items={data.down}
          onOpen={setPriceCard}
          empty={t(
            "Nada ha bajado en este periodo (o aún no hay dos días de precios).",
            "Nothing went down in this period (or there aren't two days of prices yet).",
          )}
        />
      </div>
      <p className="subtle text-xs">
        {t(
          `Precio de referencia del mercado europeo de la impresión más barata de cada carta, guardado cada noche (hay datos desde el ${first?.date ?? data.latest}). Ordenado por lo que cambia el valor de tus copias.`,
          `European market reference price of each card's cheapest printing, saved every night (data since ${first?.date ?? data.latest}). Sorted by how much the value of your copies changes.`,
        )}
      </p>
      <CardPriceDialog card={priceCard} onClose={() => setPriceCard(null)} />
    </div>
  );
}
