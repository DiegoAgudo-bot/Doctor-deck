import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { DeckSettingsSheet } from "~/components/deck-manage";
import { DeckTile } from "~/components/deck-tile";
import { Button, Empty, ErrorView, Fab, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";
import { t } from "~/lib/i18n";

/**
 * Mis mazos, con el arte del comandante de portada (como la lista de mazos de ManaBox).
 * Mantener pulsado uno abre sus ajustes: renombrar, visibilidad, duplicar, borrar…
 */
export default function Decks() {
  const [settings, setSettings] = useState<string | null>(null);
  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
  });

  if (decks.isPending) return <Loading />;
  if (decks.isError && !decks.data)
    return <ErrorView error={decks.error} onRetry={() => decks.refetch()} />;
  const list = [...(decks.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (list.length === 0) {
    return (
      <Empty
        icon="layers-outline"
        title={t("Aún no tienes mazos", "You don't have any decks yet")}
        text={t(
          "Empieza desde un comandante (con el mazo medio de la comunidad o con tus cartas), pega una lista o compártela desde otra app.",
          "Start from a commander (with the community's average deck or with your cards), paste a list or share it from another app.",
        )}
        action={
          <Button
            label={t("Nuevo mazo", "New deck")}
            icon="add"
            onPress={() => router.push("/deck-new")}
          />
        }
      />
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <T variant="small">
            {t(
              "Mantén pulsado un mazo para cambiarle el nombre, duplicarlo o borrarlo.",
              "Press and hold a deck to rename, duplicate or delete it.",
            )}
          </T>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={decks.isRefetching}
            onRefresh={() => decks.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        renderItem={({ item }) => <DeckTile deck={item} onLongPress={() => setSettings(item.id)} />}
      />
      <Fab
        icon="add"
        label={t("Nuevo mazo", "New deck")}
        onPress={() => router.push("/deck-new")}
      />
      {settings && <DeckSettingsSheet deckId={settings} open onClose={() => setSettings(null)} />}
    </View>
  );
}
