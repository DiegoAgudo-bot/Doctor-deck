import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import type { CatalogPageDTO } from "@/server/card-dto";
import { CardThumb } from "~/components/card-bits";
import { FilterSheetBody } from "~/components/filters";
import { Sheet } from "~/components/sheet";
import { Button, Chip, Empty, ErrorView, Loading, SearchField, T } from "~/components/ui";
import { useAddCopies, useCopyDefaults } from "~/lib/add-copies";
import { api } from "~/lib/api";
import {
  activeFilters,
  catalogParams,
  EMPTY_FILTERS,
  TYPE_OPTIONS,
  type Filters,
} from "~/lib/collection-filters";
import { euros, thousands } from "~/lib/format";
import { useDebounced } from "~/lib/hooks";
import { colors, manaColors } from "~/lib/theme";

const PAGE = 45;
const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

/**
 * Buscador de todas las cartas: nombre, tipo o texto, y en la hoja «Filtros» lo mismo que
 * ManaBox (colores, tipo, supertipo, texto de reglas, coste, fuerza, rareza, edición…).
 */
export default function Search() {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(false);
  const query = useDebounced(q.trim());
  const applied = useDebounced(filters, 400);
  const chips = activeFilters(filters).filter((c) => c.key !== "colors");
  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const [defaults] = useCopyDefaults();
  const addCopies = useAddCopies();

  const key = catalogParams(applied, query).toString();

  const list = useInfiniteQuery({
    queryKey: ["catalog", key],
    queryFn: ({ pageParam }) =>
      api<CatalogPageDTO>(`/api/cards?${key}${key ? "&" : ""}offset=${pageParam}&limit=${PAGE}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((s, p) => s + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total;
  const tile = (width - 32 - 16) / 3;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        <SearchField
          placeholder="Nombre, tipo o texto, en cualquier idioma"
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
          autoFocus={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6, alignItems: "center" }}
        >
          <Chip
            label={chips.length > 0 ? `Filtros · ${chips.length}` : "Filtros"}
            icon="options-outline"
            active={chips.length > 0}
            onPress={() => setSheet(true)}
          />
          {COLORS.map((c) => {
            const on = filters.colors.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityLabel={`Color ${c}`}
                accessibilityState={{ selected: on }}
                onPress={() =>
                  setF({
                    colors: on ? filters.colors.filter((x) => x !== c) : [...filters.colors, c],
                  })
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: manaColors[c],
                  opacity: on || filters.colors.length === 0 ? 1 : 0.35,
                  borderWidth: on ? 2 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
          {chips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              trailingIcon="close"
              accessibilityLabel={`Quitar el filtro ${c.label}`}
              onPress={() => setF(c.clear)}
            />
          ))}
          {filters.types.length === 0 &&
            TYPE_OPTIONS.slice(0, 7).map((t) => (
              <Chip key={t.key} label={t.label} onPress={() => setF({ types: [t.key] })} />
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
        <Empty
          icon="search"
          title="Ninguna carta"
          text="Prueba con otro nombre (en inglés) o quita filtros."
          action={
            chips.length > 0 || filters.colors.length > 0 ? (
              <Button
                label="Quitar filtros"
                kind="secondary"
                onPress={() => setFilters(EMPTY_FILTERS)}
              />
            ) : undefined
          }
        />
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

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtrar cartas"
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Quitar filtros"
              kind="secondary"
              disabled={chips.length === 0 && filters.colors.length === 0}
              onPress={() => setFilters(EMPTY_FILTERS)}
              style={{ flex: 1 }}
            />
            <Button
              label={total !== undefined ? `Ver ${thousands(total)}` : "Ver"}
              onPress={() => setSheet(false)}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <FilterSheetBody f={filters} set={setF} mode="catalog" />
      </Sheet>
    </View>
  );
}
