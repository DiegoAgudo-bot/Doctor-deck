import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import type { FeedDTO } from "@/server/social-dto";
import { FeedEntry } from "~/components/feed-entry";
import { Button, Chip, Empty, ErrorView, Loading } from "~/components/ui";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";
import { t } from "~/lib/i18n";

const FILTERS: [string, string][] = [
  ["", t("Todo", "All")],
  ["deck", t("Mazos", "Decks")],
  ["game", t("Partidas", "Games")],
  ["comment", t("Comentarios", "Comments")],
  ["like", t("Me gusta", "Likes")],
  ["trade", t("Intercambios", "Trades")],
];

/** Lo que hace la gente a la que sigo y mis compañeros de grupo. */
export default function Feed() {
  const [type, setType] = useState("");
  const feed = useInfiniteQuery({
    queryKey: ["feed", type],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams();
      if (type) q.set("types", type);
      if (pageParam) q.set("before", pageParam);
      return api<FeedDTO>(`/api/feed?${q}`);
    },
    getNextPageParam: (last) => last.next,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const following = feed.data?.pages[0]?.following ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 6, padding: 12 }}
      >
        {FILTERS.map(([t, label]) => (
          <Chip key={t} label={label} active={type === t} onPress={() => setType(t)} />
        ))}
      </ScrollView>
      {feed.isPending ? (
        <Loading />
      ) : feed.isError && !feed.data ? (
        <ErrorView error={feed.error} onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <Empty
          icon="newspaper-outline"
          title={
            following === 0
              ? t("Aún no sigues a nadie", "You don't follow anyone yet")
              : t("Nada nuevo por aquí", "Nothing new here")
          }
          text={t(
            "Aquí salen los mazos, partidas, comentarios e intercambios de la gente que sigues y de tus grupos.",
            "Here you'll see the decks, games, comments and trades of people you follow and your groups.",
          )}
          action={
            <Button
              label={t("Buscar gente y mazos", "Find people and decks")}
              kind="secondary"
              icon="globe-outline"
              onPress={() => router.push("/community")}
            />
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <FeedEntry item={item} />}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : null}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => feed.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}
    </View>
  );
}
