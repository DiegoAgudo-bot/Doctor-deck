import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import type { CollectionCardDTO, CollectionViewResponse } from "@/server/dto";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { Chip, Empty, ErrorView, IconButton, Loading, SearchField, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros, thousands } from "~/lib/format";
import { conditionShort } from "~/lib/copies";
import { useDebounced, useStoredState } from "~/lib/hooks";
import { pickImportFile } from "~/lib/import-file";
import { colors, manaColors } from "~/lib/theme";

const PAGE = 60;
const SORTS = [
  { key: "valor", label: "Valor" },
  { key: "nombre", label: "Nombre" },
  { key: "recientes", label: "Recientes" },
  { key: "copias", label: "Copias" },
  { key: "precio", label: "Precio" },
  { key: "coste", label: "Coste" },
] as const;
type Sort = (typeof SORTS)[number]["key"];
const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

/** Mi colección agrupada por carta, como la de ManaBox: buscar, ordenar, filtrar, lista o rejilla. */
export default function Collection() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [grid, setGrid] = useStoredState("collection.grid", false);
  const [sort, setSort] = useStoredState<Sort>("collection.sort", "valor");
  const [desc, setDesc] = useStoredState("collection.desc", true);
  // Como ManaBox: una fila por variante (edición, foil, idioma, estado); o todas juntas por carta.
  const [by, setBy] = useStoredState<"copy" | "card">("collection.by", "copy");
  const [q, setQ] = useState("");
  const [colorsOn, setColorsOn] = useState<string[]>([]);
  const [foil, setFoil] = useState(false);
  const [free, setFree] = useState(false);
  const query = useDebounced(q.trim());

  const body = useMemo(
    () => ({
      filters: {
        ...(query ? { q: query } : {}),
        ...(colorsOn.length > 0 ? { colors: colorsOn, colorMode: "alguno" } : {}),
        ...(foil ? { foil: true } : {}),
        ...(free ? { use: "libres" } : {}),
      },
      by,
      sort,
      dir: desc ? "desc" : "asc",
    }),
    [query, colorsOn, foil, free, sort, desc, by],
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
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const first = list.data?.pages[0];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", marginRight: 8 }}>
          <IconButton
            icon={grid ? "list" : "grid-outline"}
            label={grid ? "Ver en lista" : "Ver en rejilla"}
            onPress={() => setGrid(!grid)}
          />
          <IconButton icon="add" label="Añadir" onPress={addMenu} />
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

  const columns = grid ? 3 : 1;
  const tile = (width - 16 * 2 - 8 * (columns - 1)) / columns;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
        <SearchField
          placeholder="Buscar en tu colección"
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 16 }}
        >
          <Chip
            label={by === "copy" ? "Por copia" : "Por carta"}
            icon={by === "copy" ? "copy-outline" : "albums-outline"}
            onPress={() => setBy(by === "copy" ? "card" : "copy")}
          />
          <View style={{ width: 1, backgroundColor: colors.line, marginHorizontal: 4 }} />
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              active={sort === s.key}
              icon={sort === s.key ? (desc ? "arrow-down" : "arrow-up") : undefined}
              onPress={() => pickSort(s.key)}
            />
          ))}
          <View style={{ width: 1, backgroundColor: colors.line, marginHorizontal: 4 }} />
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
          <Chip label="★ Foil" active={foil} onPress={() => setFoil(!foil)} />
          <Chip label="Libres" active={free} onPress={() => setFree(!free)} />
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
            text="Comparte tu colección o una lista desde ManaBox con Doctor Deck, o importa el CSV."
            action={
              <Chip
                label="Importar fichero"
                icon="document-outline"
                onPress={() => pickImportFile()}
              />
            }
          />
        ) : (
          <Empty icon="search" title="Nada con esos filtros" />
        )
      ) : (
        <FlatList
          key={grid ? "grid" : "list"}
          data={items}
          numColumns={columns}
          keyExtractor={(c) => c.key}
          contentContainerStyle={{ padding: 16, gap: grid ? 8 : 0 }}
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
    </View>
  );
}

function addMenu() {
  const options = ["Buscar una carta", "Importar fichero (CSV o lista)", "Cancelar"];
  const run = (i: number) => {
    if (i === 0) router.push("/search");
    if (i === 1)
      pickImportFile().catch((e: unknown) => Alert.alert("No se ha podido leer", String(e)));
  };
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, run);
  } else {
    Alert.alert(
      "Añadir a la colección",
      "Para importar desde ManaBox también puedes compartir la lista o el CSV con Doctor Deck.",
      [
        { text: options[0] ?? "", onPress: () => run(0) },
        { text: options[1] ?? "", onPress: () => run(1) },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  }
}

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
        <T variant="mono">{euros(item.value)}</T>
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
        {euros(item.value)}
      </T>
    </Pressable>
  );
}
