import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import type { CatalogCardDTO, CatalogPageDTO } from "@/server/card-dto";
import { CardThumb, prefetchThumbs } from "~/components/card-bits";
import { FilterSheetBody } from "~/components/filters";
import { GlobalMatches } from "~/components/global-matches";
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
import { t } from "~/lib/i18n";
import { ResultsSkeleton } from "~/components/skeleton";

const PAGE = 45;
const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

/** Una carta de la rejilla (memorizada: al llegar más páginas no se vuelven a pintar todas). */
const CatalogTile = memo(function CatalogTile({
  item,
  width,
  onAdd,
}: {
  item: CatalogCardDTO;
  width: number;
  onAdd: (item: CatalogCardDTO) => void;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/card/${item.oracleId}`)}
      onLongPress={() => onAdd(item)}
      accessibilityLabel={item.name}
      accessibilityHint={t(
        "Mantén pulsada para añadir 1 copia a tu colección",
        "Press and hold to add 1 copy to your collection",
      )}
      style={({ pressed }) => ({ width, gap: 3, opacity: pressed ? 0.8 : 1 })}
    >
      <CardThumb uri={item.imageUrl} width={width} name={item.name} />
      <T variant="mono" style={{ textAlign: "center" }}>
        {euros(item.price)}
      </T>
    </Pressable>
  );
});

/**
 * Buscador de todas las cartas: nombre, tipo o texto, y en la hoja «Filtros» lo mismo que
 * ManaBox (colores, tipo, supertipo, texto de reglas, coste, fuerza, rareza, edición…). Al escribir,
 * encima salen también mis mazos y la gente que coincide.
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

  // Las más caras primero (las que no tienen precio, al final).
  const params = catalogParams(applied, query);
  params.set("sort", "price");
  const key = params.toString();

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
  // Las imágenes de cada página, en cuanto llega (no al bajar hasta ellas).
  const lastPage = list.data?.pages.at(-1);
  useEffect(() => {
    if (lastPage) prefetchThumbs(lastPage.items.map((c) => c.imageUrl));
  }, [lastPage]);
  const { mutate: add } = addCopies;
  const onAdd = useCallback(
    (item: CatalogCardDTO) =>
      add({
        oracleId: item.oracleId,
        printingLabel: item.name,
        quantity: 1,
        foil: false,
        ...defaults,
      }),
    [add, defaults],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        <SearchField
          placeholder={t("Cartas, tus mazos o gente", "Cards, your decks or people")}
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
            label={
              chips.length > 0
                ? t(`Filtros · ${chips.length}`, `Filters · ${chips.length}`)
                : t("Filtros", "Filters")
            }
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
              accessibilityLabel={t(`Quitar el filtro ${c.label}`, `Remove the ${c.label} filter`)}
              onPress={() => setF(c.clear)}
            />
          ))}
          {filters.types.length === 0 &&
            TYPE_OPTIONS.slice(0, 7).map((t) => (
              <Chip key={t.key} label={t.label} onPress={() => setF({ types: [t.key] })} />
            ))}
        </ScrollView>
        {total !== undefined && (
          <T variant="small">
            {thousands(total)}{" "}
            {t(
              "cartas · mantén pulsada una para añadir 1 copia",
              "cards · press and hold one to add 1 copy",
            )}
          </T>
        )}
      </View>
      {list.isPending || (list.isPlaceholderData && list.isFetching) ? (
        // Mientras llega una búsqueda nueva, sus resultados «sombreados».
        <ResultsSkeleton columns={3} tile={tile} rows={4} />
      ) : list.isError && items.length === 0 ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <>
          {query.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <GlobalMatches query={query} cards={false} />
            </View>
          )}
          <Empty
            icon="search"
            title={t("Ninguna carta", "No cards")}
            text={t(
              "Prueba con otro nombre (en inglés) o quita filtros.",
              "Try another name or remove filters.",
            )}
            action={
              chips.length > 0 || filters.colors.length > 0 ? (
                <Button
                  label={t("Quitar filtros", "Clear filters")}
                  kind="secondary"
                  onPress={() => setFilters(EMPTY_FILTERS)}
                />
              ) : undefined
            }
          />
        </>
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(c) => c.oracleId}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          // La página siguiente se pide con antelación (más de una pantalla antes del final).
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={1.5}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={9}
          removeClippedSubviews
          renderItem={({ item }) => <CatalogTile item={item} width={tile} onAdd={onAdd} />}
          ListHeaderComponent={query ? <GlobalMatches query={query} /> : null}
          ListFooterComponent={list.isFetchingNextPage ? <Loading /> : null}
        />
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t("Filtrar cartas", "Filter cards")}
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label={t("Quitar filtros", "Clear filters")}
              kind="secondary"
              disabled={chips.length === 0 && filters.colors.length === 0}
              onPress={() => setFilters(EMPTY_FILTERS)}
              style={{ flex: 1 }}
            />
            <Button
              label={
                total !== undefined
                  ? t(`Ver ${thousands(total)}`, `Show ${thousands(total)}`)
                  : t("Ver", "Show")
              }
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
