import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { CardDTO, SavedDeckSummaryDTO } from "@/server/dto";
import { DeckSettingsSheet } from "~/components/deck-manage";
import { DeckTile } from "~/components/deck-tile";
import { Button, Chip, Empty, ErrorView, Fab, Loading, SearchField, T } from "~/components/ui";
import { fold } from "~/lib/global-search";
import { useDebounced } from "~/lib/hooks";
import { api } from "~/lib/api";
import { colors, manaColors } from "~/lib/theme";
import { t } from "~/lib/i18n";

/**
 * Mis mazos, con el arte del comandante de portada (como la lista de mazos de ManaBox).
 * Mantener pulsado uno abre sus ajustes: renombrar, visibilidad, duplicar, borrar…
 */
export default function Decks() {
  const [settings, setSettings] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [colorF, setColorF] = useState<string[]>([]);
  // «Mazos con esta carta»: se elige entre las cartas que se parecen a lo escrito.
  const [card, setCard] = useState<{ oracleId: string; name: string } | null>(null);
  const query = useDebounced(find.trim(), 300);

  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
  });
  const withCard = useQuery({
    queryKey: ["decks", "card", card?.oracleId],
    queryFn: () => api<SavedDeckSummaryDTO[]>(`/api/decks?card=${card!.oracleId}`),
    enabled: card !== null,
  });
  const suggestions = useQuery({
    queryKey: ["card-search", query],
    queryFn: () => api<CardDTO[]>(`/api/cards/search?q=${encodeURIComponent(query)}&limit=4`),
    enabled: card === null && query.length >= 3,
    placeholderData: keepPreviousData,
  });

  if (decks.isPending) return <Loading />;
  if (decks.isError && !decks.data)
    return <ErrorView error={decks.error} onRetry={() => decks.refetch()} />;
  const all = [...(decks.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (all.length === 0) {
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

  const q = fold(query);
  const cardIds = card ? new Set((withCard.data ?? []).map((d) => d.id)) : null;
  const list = all.filter(
    (d) =>
      (card !== null || !q || fold(`${d.name} ${d.commanderNames.join(" ")}`).includes(q)) &&
      (!cardIds || cardIds.has(d.id)) &&
      colorF.every((c) =>
        c === "C" ? d.colorIdentity.length === 0 : d.colorIdentity.includes(c as never),
      ),
  );
  const filtering = q !== "" || card !== null || colorF.length > 0;
  const cardOptions = card === null && query.length >= 3 ? (suggestions.data ?? []) : [];

  const header = (
    <View style={{ gap: 10 }}>
      <SearchField
        value={card ? "" : find}
        onChangeText={(v) => {
          setCard(null);
          setFind(v);
        }}
        onClear={() => {
          setCard(null);
          setFind("");
        }}
        placeholder={t("Nombre, comandante o una carta", "Name, commander or a card")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, alignItems: "center" }}
      >
        {COLORS.map((c) => {
          const on = colorF.includes(c);
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t("Color", "Color")} ${c}`}
              onPress={() => setColorF(on ? colorF.filter((x) => x !== c) : [...colorF, c])}
              hitSlop={4}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: manaColors[c],
                opacity: on || colorF.length === 0 ? 1 : 0.35,
                borderWidth: on ? 2 : 0,
                borderColor: colors.text,
              }}
            />
          );
        })}
        {card && (
          <Chip
            label={t(`Con ${card.name}`, `With ${card.name}`)}
            active
            trailingIcon="close"
            onPress={() => setCard(null)}
          />
        )}
        {cardOptions.map((c) => (
          <Chip
            key={c.oracleId}
            label={t(`Con ${c.name}`, `With ${c.name}`)}
            icon="albums-outline"
            onPress={() => {
              setCard({ oracleId: c.oracleId, name: c.name });
              setFind("");
            }}
          />
        ))}
      </ScrollView>
      <T variant="small">
        {filtering
          ? withCard.isFetching
            ? t("Buscando…", "Searching…")
            : t(`${list.length} de ${all.length} mazos`, `${list.length} of ${all.length} decks`)
          : t(
              "Mantén pulsado un mazo para cambiarle el nombre, duplicarlo o borrarlo.",
              "Press and hold a deck to rename, duplicate or delete it.",
            )}
      </T>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={card && withCard.isPending ? [] : list}
        keyExtractor={(d) => d.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={
          card && withCard.isPending ? (
            <Loading />
          ) : (
            <Empty
              icon="search"
              title={
                card
                  ? t(`Ningún mazo lleva ${card.name}`, `No deck has ${card.name}`)
                  : t("Ningún mazo con esos filtros", "No decks match")
              }
            />
          )
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={decks.isRefetching}
            onRefresh={() => {
              void decks.refetch();
              if (card) void withCard.refetch();
            }}
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

const COLORS = ["W", "U", "B", "R", "G", "C"] as const;
