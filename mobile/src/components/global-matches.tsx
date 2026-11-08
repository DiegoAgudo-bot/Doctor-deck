import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { SavedDeckSummaryDTO, UserSummaryDTO } from "@/server/dto";
import { CardThumb } from "~/components/card-bits";
import { PersonRow } from "~/components/social";
import { T } from "~/components/ui";
import { api } from "~/lib/api";
import { matchDecks } from "~/lib/global-search";
import { colors, radius } from "~/lib/theme";
import { t } from "~/lib/i18n";

/**
 * Encima de las cartas, al escribir en Buscar: mis mazos (por nombre o comandante) y gente (por
 * nombre o usuario), como el buscador de la cabecera de la web.
 */
export function GlobalMatches({
  query,
  cards = true,
}: {
  query: string;
  /** Si debajo vienen cartas (pone su título). */
  cards?: boolean;
}) {
  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
    staleTime: 60_000,
  });
  const people = useQuery({
    queryKey: ["users", query],
    queryFn: () => api<UserSummaryDTO[]>(`/api/users?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
  const myDecks = matchDecks(decks.data ?? [], query);
  const users = query.length >= 2 ? (people.data ?? []).slice(0, 3) : [];
  if (myDecks.length === 0 && users.length === 0) return null;
  return (
    <View style={{ gap: 4, paddingBottom: 8 }}>
      {myDecks.length > 0 && <T variant="label">{t("Tus mazos", "Your decks")}</T>}
      {myDecks.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => router.push(`/deck/${d.id}`)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 8,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.hover : colors.panel,
          })}
        >
          <CardThumb uri={d.commanderCard?.imageUrl} width={34} name={d.name} />
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} style={{ fontWeight: "600" }}>
              {d.name}
            </T>
            <T variant="small" numberOfLines={1}>
              {d.commanderNames.join(" + ") || t("Sin comandante", "No commander")}
            </T>
          </View>
        </Pressable>
      ))}
      {users.length > 0 && (
        <T variant="label" style={{ marginTop: myDecks.length > 0 ? 8 : 0 }}>
          {t("Gente", "People")}
        </T>
      )}
      {users.length > 0 && (
        <View style={{ marginHorizontal: -16 }}>
          {users.map((u) => (
            <PersonRow
              key={u.username}
              person={u}
              detail={`${u.publicDecks} ${u.publicDecks === 1 ? t("mazo", "deck") : t("mazos", "decks")}`}
            />
          ))}
        </View>
      )}
      {cards && (
        <T variant="label" style={{ marginTop: 8 }}>
          {t("Cartas", "Cards")}
        </T>
      )}
    </View>
  );
}
