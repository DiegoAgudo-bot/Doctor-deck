import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import type {
  CollectionViewResponse,
  SavedDeckSummaryDTO,
  TradeProposalSummaryDTO,
} from "@/server/dto";
import type { FeedDTO } from "@/server/social-dto";
import { DeckTile } from "~/components/deck-tile";
import { FeedEntry } from "~/components/feed-entry";
import { SectionTitle } from "~/components/social";
import { Banner, Button, type IconName, T } from "~/components/ui";
import { api } from "~/lib/api";
import { useSession } from "~/lib/auth";
import { euros, thousands } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

/**
 * Inicio (como el panel de la web): mi colección y lo que vale, mis mazos recientes, las propuestas
 * que me toca responder y la actividad de la gente que sigo.
 */
export default function Home() {
  const { data: session } = useSession();
  const totals = useQuery({
    queryKey: ["collection", "totals"],
    queryFn: () =>
      api<CollectionViewResponse>("/api/collection/view", {
        body: { filters: {}, offset: 0, limit: 0 },
      }),
  });
  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
  });
  const proposals = useQuery({
    queryKey: ["proposals"],
    queryFn: () => api<TradeProposalSummaryDTO[]>("/api/trades/proposals"),
  });
  const feed = useQuery({
    queryKey: ["feed", "home"],
    queryFn: () => api<FeedDTO>("/api/feed"),
  });
  const refreshing =
    totals.isRefetching || decks.isRefetching || proposals.isRefetching || feed.isRefetching;
  const refresh = () => {
    void totals.refetch();
    void decks.refetch();
    void proposals.refetch();
    void feed.refetch();
  };

  const overall = totals.data?.overall;
  const myTurn = proposals.data?.filter((p) => p.myTurn).length ?? 0;
  const recent = [...(decks.data ?? [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const activity = feed.data?.items.slice(0, 5) ?? [];
  const firstName = session?.user.name?.split(" ")[0];

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <T variant="title">{firstName ? `Hola, ${firstName}` : "Hola"}</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile
            icon="albums-outline"
            label="Tu colección"
            value={overall ? `${thousands(overall.copies)} copias` : "…"}
            detail={overall ? `Vale ${euros(overall.value)}` : " "}
            onPress={() => router.push("/collection-prices")}
          />
          <StatTile
            icon="swap-horizontal-outline"
            label="Intercambios"
            value={proposals.data ? thousands(myTurn) : "…"}
            detail={myTurn > 0 ? "Por responder" : "Ver cruces"}
            tone={myTurn > 0 ? colors.warn : undefined}
            onPress={() => router.push(myTurn > 0 ? "/trades?tab=proposals" : "/trades")}
          />
        </View>
        {overall && overall.copies === 0 && (
          <Banner
            tone="info"
            text="Aún no tienes cartas. Escanéalas, búscalas o comparte el CSV de tu colección con la app para que los mazos usen lo que tienes."
          />
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Nuevo mazo"
            icon="add"
            onPress={() => router.push("/deck-new")}
            style={{ flex: 1 }}
          />
          <Button
            label="Escanear"
            kind="secondary"
            icon="scan-outline"
            onPress={() => router.push("/scan")}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <SectionTitle
        right={
          decks.data && decks.data.length > 3 ? (
            <T
              variant="small"
              style={{ color: colors.accent }}
              onPress={() => router.push("/decks")}
            >
              Ver todos ({decks.data.length})
            </T>
          ) : undefined
        }
      >
        Tus mazos
      </SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {decks.data && decks.data.length === 0 ? (
          <T variant="small">
            Aún no tienes ningún mazo. Crea uno desde un comandante o pega una lista.
          </T>
        ) : (
          recent.map((d) => <DeckTile key={d.id} deck={d} />)
        )}
      </View>

      <SectionTitle
        right={
          <T variant="small" style={{ color: colors.accent }} onPress={() => router.push("/feed")}>
            Ver toda
          </T>
        }
      >
        Actividad
      </SectionTitle>
      {feed.data && activity.length === 0 ? (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <T variant="small">
            {feed.data.following === 0
              ? "Sigue a gente o únete a un grupo y aquí verás sus mazos, partidas e intercambios."
              : "Nada nuevo de la gente que sigues."}
          </T>
          <Button
            label="Buscar gente y mazos"
            kind="secondary"
            icon="globe-outline"
            onPress={() => router.push("/community")}
          />
        </View>
      ) : (
        activity.map((i) => <FeedEntry key={i.id} item={i} />)
      )}
    </ScrollView>
  );
}

function StatTile({
  icon,
  label,
  value,
  detail,
  tone,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  tone?: string | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${detail}`}
      style={({ pressed }) => ({
        flex: 1,
        gap: 2,
        padding: 12,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.hover : colors.panel,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={colors.text3} />
        <T variant="small">{label}</T>
      </View>
      <T variant="h2" style={tone ? { color: tone } : undefined}>
        {value}
      </T>
      <T variant="small">{detail}</T>
    </Pressable>
  );
}
