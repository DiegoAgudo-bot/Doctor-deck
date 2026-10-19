import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import type { CollectionCardDTO, CollectionViewResponse } from "@/server/dto";
import { Bell } from "~/components/bell";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { FilterSheetBody } from "~/components/filters";
import { OptionRow, Sheet } from "~/components/sheet";
import {
  Button,
  Chip,
  Empty,
  ErrorView,
  Fab,
  IconButton,
  Loading,
  SearchField,
  Segmented,
  T,
} from "~/components/ui";
import { api } from "~/lib/api";
import { euros, thousands } from "~/lib/format";
import { conditionShort } from "~/lib/copies";
import { useDebounced, useStoredState } from "~/lib/hooks";
import { pickImportFile } from "~/lib/import-file";
import {
  activeFilters,
  collectionQuery,
  EMPTY_FILTERS,
  type Filters,
} from "~/lib/collection-filters";
import { colors } from "~/lib/theme";

const PAGE = 60;
// Se ordena por lo que vale una copia (lo que se enseña), no por lo que valen todas juntas.
const SORTS = [
  { key: "precio", label: "Precio" },
  { key: "nombre", label: "Nombre" },
  { key: "recientes", label: "Recientes" },
  { key: "copias", label: "Copias" },
  { key: "coste", label: "Coste" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

/** Mi colección agrupada por carta, como la de ManaBox: buscar, ordenar, filtrar, lista o rejilla. */
export default function Collection() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [grid, setGrid] = useStoredState("collection.grid", false);
  const [stored, setSort] = useStoredState<Sort | "valor">("collection.sort", "precio");
  // Antes había «Valor» (el total de las copias); quien lo tenía guardado pasa a «Precio».
  const sort: Sort = stored === "valor" ? "precio" : stored;
  const [desc, setDesc] = useStoredState("collection.desc", true);
  // Como ManaBox: una fila por variante (edición, foil, idioma, estado); o todas juntas por carta.
  const [by, setBy] = useStoredState<"copy" | "card">("collection.by", "copy");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState<"sort" | "filters" | "add" | null>(null);
  const query = useDebounced(q.trim());
  // Lo que se escribe en la hoja (texto, rangos) se aplica al dejar de escribir.
  const applied = useDebounced(filters, 400);
  const chips = activeFilters(filters);
  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const body = useMemo(
    () => ({
      filters: { ...(query ? { q: query } : {}), ...collectionQuery(applied) },
      by,
      sort,
      dir: desc ? "desc" : "asc",
    }),
    [query, applied, sort, desc, by],
  );

  const list = useInfiniteQuery({
    queryKey: ["collection", body],
    queryFn: ({ pageParam }) =>
      api<CollectionViewResponse>("/api/collection/view", {
        body: { ...body, offset: pageParam, limit: PAGE },
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((s, p) => s + p.items.length, 0);
      return loaded < last.total.cards ? loaded : undefined;
    },
    // Al cambiar un filtro se sigue viendo lo de antes hasta que llega lo nuevo.
    placeholderData: keepPreviousData,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const first = list.data?.pages[0];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <IconButton
            icon={grid ? "list" : "grid-outline"}
            label={grid ? "Ver en lista" : "Ver en rejilla"}
            onPress={() => setGrid(!grid)}
          />
          <Bell />
        </View>
      ),
    });
  });

  const pickSort = (key: Sort) => {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      setDesc(key !== "nombre" && key !== "coste");
    }
  };
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Orden";

  const columns = grid ? 3 : 1;
  const tile = (width - 16 * 2 - 8 * (columns - 1)) / columns;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        <SearchField
          placeholder="Buscar en tu colección (cualquier idioma)"
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
        />
        {/* Como ManaBox: ordenar y filtrar en hojas; aquí solo lo que está activo. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6, paddingRight: 16 }}
        >
          <Chip
            label={sortLabel}
            icon={desc ? "arrow-down" : "arrow-up"}
            trailingIcon="chevron-down"
            accessibilityLabel={`Ordenar: ${sortLabel}`}
            onPress={() => setSheet("sort")}
          />
          <Chip
            label={chips.length > 0 ? `Filtros · ${chips.length}` : "Filtros"}
            icon="options-outline"
            active={chips.length > 0}
            onPress={() => setSheet("filters")}
          />
          {chips.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              trailingIcon="close"
              accessibilityLabel={`Quitar el filtro ${c.label}`}
              onPress={() => setF(c.clear)}
            />
          ))}
        </ScrollView>
        {first && (
          <T variant="small">
            {thousands(first.total.cards)} {by === "copy" ? "filas" : "cartas"} ·{" "}
            {thousands(first.total.copies)} copias ·{" "}
            <T variant="small" style={{ color: colors.text, fontWeight: "600" }}>
              {euros(first.total.value)}
            </T>
          </T>
        )}
      </View>

      {list.isPending ? (
        <Loading />
      ) : list.isError && items.length === 0 ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        first && first.overall.cards === 0 ? (
          <Empty
            icon="albums-outline"
            title="Tu colección está vacía"
            text="Busca tus cartas y añádelas, importa el CSV de tu colección o compártelo con Doctor Deck desde otra app."
            action={
              <View style={{ gap: 8, alignSelf: "stretch" }}>
                <Button
                  label="Buscar una carta"
                  icon="search"
                  onPress={() => router.push("/search")}
                />
                <Button
                  label="Importar fichero (CSV o lista)"
                  icon="document-outline"
                  kind="secondary"
                  onPress={importFile}
                />
              </View>
            }
          />
        ) : (
          <Empty
            icon="search"
            title="Nada con esos filtros"
            action={
              chips.length > 0 || q ? (
                <Button
                  label="Quitar filtros"
                  kind="secondary"
                  onPress={() => {
                    clearFilters();
                    setQ("");
                  }}
                />
              ) : undefined
            }
          />
        )
      ) : (
        <FlatList
          key={grid ? "grid" : "list"}
          data={items}
          numColumns={columns}
          keyExtractor={(c) => c.key}
          contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: grid ? 8 : 0 }}
          keyboardDismissMode="on-drag"
          {...(grid ? { columnWrapperStyle: { gap: 8 } } : {})}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => list.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) =>
            grid ? <GridTile item={item} width={tile} /> : <Row item={item} />
          }
          ListFooterComponent={list.isFetchingNextPage ? <Loading /> : null}
        />
      )}

      <Fab icon="add" label="Añadir cartas" onPress={() => setSheet("add")} />

      <Sheet open={sheet === "sort"} onClose={() => setSheet(null)} title="Ordenar">
        <View style={{ gap: 2 }}>
          {SORTS.map((s) => (
            <OptionRow
              key={s.key}
              label={s.label}
              selected={sort === s.key}
              onPress={() => pickSort(s.key)}
              right={
                sort === s.key ? (
                  <Chip
                    label={desc ? "Mayor primero" : "Menor primero"}
                    icon={desc ? "arrow-down" : "arrow-up"}
                    onPress={() => setDesc(!desc)}
                  />
                ) : null
              }
            />
          ))}
        </View>
        <T variant="label">Ver</T>
        <Segmented<"copy" | "card">
          options={[
            { key: "copy", label: "Cada copia" },
            { key: "card", label: "Por carta" },
          ]}
          value={by}
          onChange={setBy}
        />
        <T variant="small">
          {by === "copy"
            ? "Una fila por edición, foil, idioma y estado."
            : "Todas las copias de una carta juntas."}
        </T>
      </Sheet>

      <Sheet
        open={sheet === "filters"}
        onClose={() => setSheet(null)}
        title="Filtrar"
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Quitar filtros"
              kind="secondary"
              disabled={chips.length === 0}
              onPress={clearFilters}
              style={{ flex: 1 }}
            />
            <Button
              label={first ? `Ver ${thousands(first.total.cards)}` : "Ver"}
              onPress={() => setSheet(null)}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <FilterSheetBody
          f={filters}
          set={setF}
          mode="collection"
          sets={first?.facets?.sets ?? []}
        />
      </Sheet>

      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} title="Añadir cartas">
        <OptionRow
          label="Escanear cartas"
          detail="Con la cámara, una tras otra (también en otros idiomas)"
          onPress={() => {
            setSheet(null);
            router.push("/scan");
          }}
        />
        <OptionRow
          label="Buscar una carta"
          detail="Elige edición, foil, idioma y estado"
          onPress={() => {
            setSheet(null);
            router.push("/search");
          }}
        />
        <OptionRow
          label="Importar fichero"
          detail="El CSV de tu colección o una lista de texto"
          onPress={() => {
            setSheet(null);
            importFile();
          }}
        />
        <T variant="small">
          Desde otra app también puedes compartir la colección o una lista con Doctor Deck (menú
          compartir de Android).
        </T>
      </Sheet>
    </View>
  );
}

const importFile = () =>
  pickImportFile().catch((e: unknown) =>
    Alert.alert("No se ha podido leer el fichero", e instanceof Error ? e.message : String(e)),
  );

const open = (c: CollectionCardDTO) => router.push(`/card/${c.card.oracleId}`);

/** Por carta: sus ediciones y el tipo. */
const cardLine = (c: CollectionCardDTO) =>
  [c.sets.slice(0, 3).join(" · "), c.card.typeLine.split("—")[0]?.trim()]
    .filter(Boolean)
    .join("  ·  ");

/** Por variante, como ManaBox: «HOB #33 · ES · NM». */
const variantLine = (c: CollectionCardDTO) => {
  const p = c.card.printing;
  return [
    p ? `${p.setCode.toUpperCase()} #${p.collectorNumber}` : (c.sets[0] ?? "Edición sin indicar"),
    c.variant?.language && c.variant.language !== "en" ? c.variant.language.toUpperCase() : null,
    conditionShort(c.variant?.condition ?? null),
  ]
    .filter(Boolean)
    .join(" · ");
};

/**
 * El precio que se enseña es siempre el de una copia, aunque tenga varias: lo que vale de verdad
 * la carta (el total de la colección sale arriba).
 */
function priceText(item: CollectionCardDTO) {
  return euros(item.value !== null ? item.value / item.quantity : item.price);
}

function Row({ item }: { item: CollectionCardDTO }) {
  return (
    <Pressable
      onPress={() => open(item)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        paddingVertical: 8,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        backgroundColor: pressed ? colors.hover : "transparent",
      })}
    >
      <CardThumb uri={item.card.imageUrl} width={44} name={item.card.name} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <T numberOfLines={1} style={{ fontWeight: "600", flexShrink: 1 }}>
            {item.card.name}
          </T>
          {item.foilQuantity > 0 && <FoilMark />}
        </View>
        <T variant="small" numberOfLines={1}>
          {item.variant ? variantLine(item) : cardLine(item)}
        </T>
        {item.inUse > 0 && (
          <T variant="small" style={{ color: colors.inuse }} numberOfLines={1}>
            {item.inUse} en mazos
          </T>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <T style={{ fontWeight: "700" }}>×{item.quantity}</T>
        <T variant="mono">{priceText(item)}</T>
      </View>
    </Pressable>
  );
}

function GridTile({ item, width }: { item: CollectionCardDTO; width: number }) {
  return (
    <Pressable onPress={() => open(item)} style={{ width, gap: 4 }}>
      <View>
        <CardThumb uri={item.card.imageUrl} width={width} name={item.card.name} />
        <View
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            backgroundColor: "rgba(0,0,0,0.75)",
            borderRadius: 8,
            paddingHorizontal: 6,
            paddingVertical: 1,
            flexDirection: "row",
            gap: 3,
            alignItems: "center",
          }}
        >
          {item.foilQuantity > 0 && <FoilMark size={10} />}
          <T variant="small" style={{ color: "#fff", fontWeight: "700" }}>
            ×{item.quantity}
          </T>
        </View>
      </View>
      <T variant="mono" style={{ textAlign: "center" }}>
        {priceText(item)}
      </T>
    </Pressable>
  );
}
