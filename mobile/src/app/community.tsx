import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { CommunityResponse, UserSummaryDTO } from "@/server/dto";
import { CommunityDeck } from "~/components/community-deck";
import { PersonRow } from "~/components/social";
import { Chip, Empty, ErrorView, Loading, SearchField, Segmented, T } from "~/components/ui";
import { api } from "~/lib/api";
import { useDebounced } from "~/lib/hooks";
import { colors, manaColors } from "~/lib/theme";

const PAGE = 20;
type Sort = "recent" | "likes" | "owned";
const COLORS = ["W", "U", "B", "R", "G"] as const;

/** Mazos públicos de la comunidad (cuánto tengo de cada uno) y buscar gente. */
export default function Community() {
  const params = useLocalSearchParams<{ q?: string; sort?: string }>();
  const [mode, setMode] = useState<"decks" | "people">("decks");
  const [q, setQ] = useState(params.q ?? "");
  const [sort, setSort] = useState<Sort>(
    params.sort === "owned" || params.sort === "likes" ? params.sort : "recent",
  );
  const [colorsOn, setColorsOn] = useState<string[]>([]);
  const [bracket, setBracket] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const query = useDebounced(q.trim(), 350);

  const filters = {
    ...(query ? { q: query } : {}),
    ...(colorsOn.length ? { colors: colorsOn.join("") } : {}),
    ...(bracket ? { bracket } : {}),
    ...(following ? { following: true } : {}),
  };
  const decks = useInfiniteQuery({
    queryKey: ["community", filters, sort],
    initialPageParam: 0,
    enabled: mode === "decks",
    queryFn: ({ pageParam }) =>
      api<CommunityResponse>("/api/community/decks", {
        body: { filters, sort, offset: pageParam, limit: PAGE },
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const people = useQuery({
    queryKey: ["users", query],
    enabled: mode === "people",
    queryFn: () => api<UserSummaryDTO[]>(`/api/users?q=${encodeURIComponent(query)}`),
  });

  const toggleColor = (c: string) =>
    setColorsOn((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const items = decks.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <View style={{ gap: 10, padding: 16, paddingBottom: 8 }}>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { key: "decks", label: "Mazos" },
          { key: "people", label: "Gente" },
        ]}
      />
      <SearchField
        placeholder={mode === "decks" ? "Nombre o comandante" : "Nombre o @usuario"}
        value={q}
        onChangeText={setQ}
        onClear={() => setQ("")}
      />
      {mode === "decks" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip
                label="Recientes"
                active={sort === "recent"}
                onPress={() => setSort("recent")}
              />
              <Chip
                label="Los que puedo montar"
                active={sort === "owned"}
                onPress={() => setSort("owned")}
              />
              <Chip
                label="Más gustados"
                active={sort === "likes"}
                onPress={() => setSort("likes")}
              />
              <Chip
                label="De quien sigo"
                icon="people-outline"
                active={following}
                onPress={() => setFollowing((f) => !f)}
              />
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: colorsOn.includes(c) }}
                  onPress={() => toggleColor(c)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: manaColors[c],
                    opacity: colorsOn.length === 0 || colorsOn.includes(c) ? 1 : 0.3,
                    borderWidth: colorsOn.includes(c) ? 2 : 0,
                    borderColor: colors.text,
                  }}
                />
              ))}
              <View style={{ width: 8 }} />
              {[2, 3, 4].map((b) => (
                <Chip
                  key={b}
                  label={`Bracket ${b}`}
                  active={bracket === b}
                  onPress={() => setBracket((x) => (x === b ? null : b))}
                />
              ))}
            </View>
          </ScrollView>
          {colorsOn.length > 0 && <T variant="small">Identidad exacta: {colorsOn.join("")}</T>}
        </>
      )}
    </View>
  );

  if (mode === "people") {
    return (
      <View style={{ flex: 1 }}>
        {header}
        {people.isPending ? (
          <Loading />
        ) : people.isError ? (
          <ErrorView error={people.error} onRetry={() => people.refetch()} />
        ) : people.data.length === 0 ? (
          <Empty icon="person-outline" title="Nadie con ese nombre" />
        ) : (
          <FlatList
            data={people.data}
            keyExtractor={(u) => u.username}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <PersonRow
                person={item}
                detail={`${item.publicDecks} mazos · ${item.followers} seguidores`}
              />
            )}
          />
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <CommunityDeck deck={item} />
        </View>
      )}
      onEndReached={() => decks.hasNextPage && !decks.isFetchingNextPage && decks.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        decks.isPending ? (
          <Loading />
        ) : decks.isError ? (
          <ErrorView error={decks.error} onRetry={() => decks.refetch()} />
        ) : (
          <Empty
            icon="layers-outline"
            title="Ningún mazo con esos filtros"
            text="Prueba con otros colores o quita algún filtro."
          />
        )
      }
      ListFooterComponent={decks.isFetchingNextPage ? <Loading /> : null}
      refreshControl={
        <RefreshControl
          refreshing={decks.isRefetching && !decks.isFetchingNextPage}
          onRefresh={() => decks.refetch()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    />
  );
}
