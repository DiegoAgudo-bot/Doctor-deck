import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { CollectionPricesDTO, PriceMoverDTO } from "@/server/dto";
import { CardThumb } from "~/components/card-bits";
import { formatChange, PERIODS, PriceChart } from "~/components/price-chart";
import { Chip, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros } from "~/lib/format";
import { colors, radius } from "~/lib/theme";
import { intl, t } from "~/lib/i18n";

/** Precios de mi colección: su valor día a día y lo que más sube y más baja (como la web). */
export default function CollectionPrices() {
  const [days, setDays] = useState<number>(30);
  const prices = useQuery({
    queryKey: ["collection-prices", days],
    staleTime: 30 * 60_000,
    queryFn: () => api<CollectionPricesDTO>("/api/collection/prices", { body: { days } }),
  });
  const p = prices.data;
  const first = p?.value[0];
  const last = p?.value.at(-1);
  const delta = first && last ? last.eur - first.eur : null;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {PERIODS.map((x) => (
          <Chip
            key={x.days}
            label={x.label}
            active={days === x.days}
            onPress={() => setDays(x.days)}
          />
        ))}
      </View>
      {prices.isPending ? (
        <Loading />
      ) : prices.isError || !p ? (
        <ErrorView error={prices.error} onRetry={() => prices.refetch()} />
      ) : (
        <>
          <View
            style={{ gap: 8, backgroundColor: colors.panel, borderRadius: radius.md, padding: 12 }}
          >
            <T variant="label">{t("Valor de tu colección", "Your collection's value")}</T>
            {last && <T style={{ fontSize: 26, fontWeight: "700" }}>{euros(last.eur)}</T>}
            {delta !== null && first && first.eur > 0 && (
              <T
                style={{
                  fontWeight: "700",
                  color: delta > 0 ? colors.in : delta < 0 ? colors.out : colors.text2,
                }}
              >
                {formatChange(delta, Math.round((delta / first.eur) * 1000) / 10)}{" "}
                {t("desde el", "since")}{" "}
                {new Date(`${first.date}T00:00:00Z`).toLocaleDateString(intl, {
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
              </T>
            )}
            <PriceChart points={p.value} height={140} />
            <T variant="small">
              {t(
                "Cada copia al precio de referencia de su edición (foil si es foil). El histórico se guarda cada noche.",
                "Each copy at the reference price of its printing (foil if it's foil). The history is saved every night.",
              )}
            </T>
          </View>
          <Movers title={t("Lo que más sube", "Biggest risers")} items={p.up} />
          <Movers title={t("Lo que más baja", "Biggest fallers")} items={p.down} />
        </>
      )}
    </ScrollView>
  );
}

function Movers({ title, items }: { title: string; items: PriceMoverDTO[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{title}</T>
      {items.slice(0, 15).map((m) => (
        <Pressable
          key={`${m.card.oracleId}-${m.card.printing?.scryfallId ?? ""}-${m.foil}`}
          onPress={() => router.push(`/card/${m.card.oracleId}`)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 8,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.hover : colors.panel,
          })}
        >
          <CardThumb uri={m.card.imageUrl} width={34} name={m.card.name} />
          <View style={{ flex: 1 }}>
            <T numberOfLines={1}>
              {m.card.name}
              {m.foil ? " ★" : ""}
            </T>
            <T variant="small" numberOfLines={1}>
              {m.copies > 1 ? `${m.copies} ${t("copias", "copies")} · ` : ""}
              {euros(m.before)} → {euros(m.now)}
            </T>
          </View>
          <T
            variant="mono"
            style={{
              color: m.valueDelta > 0 ? colors.in : m.valueDelta < 0 ? colors.out : colors.text2,
            }}
          >
            {formatChange(m.valueDelta, m.percent)}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
