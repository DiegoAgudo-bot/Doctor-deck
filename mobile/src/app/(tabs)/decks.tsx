import { useQuery } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { DeckTile } from "~/components/deck-tile";
import { Button, Empty, ErrorView, IconButton, Loading } from "~/components/ui";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";

/** Mis mazos, con el arte del comandante de portada (como la lista de mazos de ManaBox). */
export default function Decks() {
  const navigation = useNavigation();
  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 8 }}>
          <IconButton icon="add" label="Nuevo mazo" onPress={() => router.push("/deck-new")} />
        </View>
      ),
    });
  });

  if (decks.isPending) return <Loading />;
  if (decks.isError && !decks.data)
    return <ErrorView error={decks.error} onRetry={() => decks.refetch()} />;
  const list = [...(decks.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (list.length === 0) {
    return (
      <Empty
        icon="layers-outline"
        title="Aún no tienes mazos"
        text="Pega una lista o un enlace de Moxfield/Archidekt, o comparte la lista desde ManaBox."
        action={<Button label="Nuevo mazo" icon="add" onPress={() => router.push("/deck-new")} />}
      />
    );
  }
  return (
    <FlatList
      data={list}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={decks.isRefetching}
          onRefresh={() => decks.refetch()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      renderItem={({ item }) => <DeckTile deck={item} />}
    />
  );
}
