import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import type { CatalogPageDTO } from "@/server/card-dto";
import { CardThumb } from "~/components/card-bits";
import { Chip, Empty, ErrorView, Loading, SearchField, T } from "~/components/ui";
import { useAddCopies, useCopyDefaults } from "~/lib/add-copies";
import { api } from "~/lib/api";
import { euros, thousands } from "~/lib/format";
import { useDebounced } from "~/lib/hooks";
import { colors, manaColors } from "~/lib/theme";

const PAGE = 45;
const TYPES = [
  ["creature", "Criatura"],
  ["instant", "Instantáneo"],
  ["sorcery", "Conjuro"],
  ["artifact", "Artefacto"],
  ["enchantment", "Encantamiento"],
  ["planeswalker", "Planeswalker"],
  ["land", "Tierra"],
] as const;
const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

/** Buscador de todas las cartas (catálogo de Scryfall): nombre, tipo o texto, colores y tipo. */
export default function Search() {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [colorsOn, setColorsOn] = useState<string[]>([]);
  const [commander, setCommander] = useState(false);
  const query = useDebounced(q.trim());
  const [defaults] = useCopyDefaults();
  const addCopies = useAddCopies();

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type) params.set("type", type);
  if (colorsOn.length > 0) {
    params.set("colors", colorsOn.join(""));
    params.set("mode", colorsOn.includes("C") ? "exact" : "includes");
  }
  if (commander) params.set("commander", "1");
  const key = params.toString();

  const list = useInfiniteQuery({
    queryKey: ["catalog", key],
    queryFn: ({ pageParam }) =>
      api<CatalogPageDTO>(`/api/cards?${key}&offset=${pageParam}&limit=${PAGE}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((s, p) => s + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total;
  const tile = (width - 32 - 16) / 3;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        <SearchField
          placeholder="Nombre, tipo o texto"
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
          autoFocus={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {COLORS.map((c) => {
            const on = colorsOn.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityLabel={`Color ${c}`}
                onPress={() => setColorsOn(on ? colorsOn.filter((x) => x !== c) : [...colorsOn, c])}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: manaColors[c],
                  opacity: on || colorsOn.length === 0 ? 1 : 0.35,
                  borderWidth: on ? 2 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
          <Chip label="Comandante" active={commander} onPress={() => setCommander(!commander)} />
          {TYPES.map(([k, label]) => (
            <Chip
              key={k}
              label={label}
              active={type === k}
              onPress={() => setType(type === k ? null : k)}
            />
          ))}
        </ScrollView>
        {total !== undefined && (
          <T variant="small">{thousands(total)} cartas · mantén pulsada una para añadir 1 copia</T>
        )}
      </View>
      {list.isPending ? (
        <Loading />
      ) : list.isError && items.length === 0 ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <Empty icon="search" title="Ninguna carta" text="Prueba con otro nombre o quita filtros." />
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(c) => c.oracleId}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/card/${item.oracleId}`)}
              onLongPress={() =>
                addCopies.mutate({
                  oracleId: item.oracleId,
                  printingLabel: item.name,
                  quantity: 1,
                  foil: false,
                  ...defaults,
                })
              }
              accessibilityLabel={item.name}
              accessibilityHint="Mantén pulsada para añadir 1 copia a tu colección"
              style={({ pressed }) => ({ width: tile, gap: 3, opacity: pressed ? 0.8 : 1 })}
            >
              <CardThumb uri={item.imageUrl} width={tile} name={item.name} />
              <T variant="mono" style={{ textAlign: "center" }}>
                {euros(item.price)}
              </T>
            </Pressable>
          )}
          ListFooterComponent={list.isFetchingNextPage ? <Loading /> : null}
        />
      )}
    </View>
  );
}
