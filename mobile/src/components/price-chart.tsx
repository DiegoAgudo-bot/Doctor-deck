import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import type { PriceChange, PricePoint } from "@/domain/prices/history";
import type { CardPricesDTO } from "@/server/dto";
import { Chip, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros } from "~/lib/format";
import { colors } from "~/lib/theme";
import { intl, t } from "~/lib/i18n";

export const PERIODS = [
  { days: 30, label: t("30 días", "30 days") },
  { days: 90, label: t("90 días", "90 days") },
  { days: 365, label: t("1 año", "1 year") },
] as const;

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(intl, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** "+2,50 € (+25 %)" / "−1,00 € (−10 %)". */
export function formatChange(delta: number, percent: number | null) {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const pct = percent === null ? "" : ` (${sign}${Math.abs(percent).toLocaleString(intl)} %)`;
  return `${sign}${euros(Math.abs(delta))}${pct}`;
}

const changeColor = (delta: number | null) =>
  delta === null || delta === 0 ? colors.text2 : delta > 0 ? colors.in : colors.out;

/**
 * Gráfica de precios (EUR por día) con barras finas: sin librerías nativas, basta para ver la
 * tendencia de 30 días a un año. Como mucho 120 barras (los días se agrupan si hay más).
 */
export function PriceChart({
  points,
  height = 110,
}: {
  points: readonly PricePoint[];
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <T variant="small">
        {points.length === 0
          ? t("Todavía no hay histórico de precios.", "No price history yet.")
          : t(
              `Solo hay precio de un día (${shortDate(points[0]!.date)}): ${euros(points[0]!.eur)}. El histórico se va guardando cada noche.`,
              `There's only one day of prices (${shortDate(points[0]!.date)}): ${euros(points[0]!.eur)}. The history is saved every night.`,
            )}
      </T>
    );
  }
  const step = Math.ceil(points.length / 120);
  const bars = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const values = bars.map((p) => p.eur);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.2 || 1;
  const lo = Math.max(0, min - span * 0.15);
  const scale = (v: number) => 6 + ((v - lo) / (max - lo || 1)) * (height - 6);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T variant="small">
          {t("máx.", "max.")} {euros(max)}
        </T>
        <T variant="small">
          {t("mín.", "min.")} {euros(min)}
        </T>
      </View>
      <View
        accessible
        accessibilityLabel={`De ${euros(points[0]!.eur)} el ${shortDate(points[0]!.date)} a ${euros(points.at(-1)!.eur)} el ${shortDate(points.at(-1)!.date)}`}
        style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 1 }}
      >
        {bars.map((p) => (
          <View
            key={p.date}
            style={{
              flex: 1,
              height: scale(p.eur),
              backgroundColor: colors.accent,
              opacity: 0.75,
              borderTopLeftRadius: 1,
              borderTopRightRadius: 1,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T variant="small">{shortDate(points[0]!.date)}</T>
        <T variant="small">{shortDate(points.at(-1)!.date)}</T>
      </View>
    </View>
  );
}

export function ChangeLine({ change }: { change: PriceChange | null | undefined }) {
  if (!change || change.delta === null) return null;
  return (
    <T style={{ color: changeColor(change.delta), fontWeight: "700" }}>
      {formatChange(change.delta, change.percent)} en el periodo
    </T>
  );
}

/** Histórico del precio de una carta (la impresión más barata), con el periodo a elegir. */
export function CardPriceHistory({ oracleId }: { oracleId: string }) {
  const [days, setDays] = useState<number>(90);
  const prices = useQuery({
    queryKey: ["card-prices", oracleId, days],
    staleTime: 60 * 60_000,
    queryFn: () => api<CardPricesDTO>(`/api/cards/${oracleId}/prices?days=${days}`),
  });
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <T variant="label" style={{ flex: 1 }}>
          {t("Precio", "Price")}
        </T>
        {PERIODS.map((p) => (
          <Chip
            key={p.days}
            label={p.label}
            active={days === p.days}
            onPress={() => setDays(p.days)}
          />
        ))}
      </View>
      {prices.data ? (
        <>
          <PriceChart points={prices.data.history} />
          <ChangeLine change={prices.data.change} />
        </>
      ) : (
        <Loading />
      )}
      <T variant="small">
        {t(
          "Precio de referencia del mercado europeo de la edición más barata. Se guarda cada noche para las cartas que hay en alguna colección o mazo.",
          "European market reference price of the cheapest printing. It's saved every night for cards that are in some collection or deck.",
        )}
      </T>
    </View>
  );
}
