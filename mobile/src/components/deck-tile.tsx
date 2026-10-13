import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { SavedDeckSummaryDTO } from "@/server/dto";
import { artUri } from "~/lib/api";
import { ago } from "~/lib/format";
import { colors, radius } from "~/lib/theme";
import { ColorPips } from "./card-bits";
import { T } from "./ui";

const VISIBILITY_ICON = {
  public: "globe-outline",
  unlisted: "link-outline",
  private: "lock-closed-outline",
} as const;

/** Un mazo con el arte del comandante de portada. */
export function DeckTile({ deck, owner }: { deck: SavedDeckSummaryDTO; owner?: string | null }) {
  const art = artUri(deck.commanderCard?.imageUrl);
  return (
    <Pressable
      onPress={() => router.push(`/deck/${deck.id}`)}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        overflow: "hidden",
        backgroundColor: colors.panel,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {art ? (
        <Image source={{ uri: art }} style={{ height: 96 }} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={{ height: 56, backgroundColor: colors.raised }} />
      )}
      <View style={{ padding: 12, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T variant="h2" numberOfLines={1} style={{ flex: 1 }}>
            {deck.name}
          </T>
          <Ionicons name={VISIBILITY_ICON[deck.visibility]} size={16} color={colors.text3} />
        </View>
        <T variant="small" numberOfLines={1}>
          {deck.commanderNames.join(" + ") || "Sin comandante"}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
          <ColorPips colors={deck.colorIdentity} />
          <T variant="small">{deck.cardCount} cartas</T>
          <View style={{ flex: 1 }} />
          <T variant="small">{owner ? `@${owner}` : ago(deck.updatedAt)}</T>
        </View>
      </View>
    </Pressable>
  );
}
