import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { FeedItemDTO } from "@/server/social-dto";
import { CardThumb } from "~/components/card-bits";
import { Avatar } from "~/components/social";
import { T } from "~/components/ui";
import { ago } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

const ICON = {
  deck: "layers-outline",
  comment: "chatbubble-outline",
  like: "heart",
  trade: "swap-horizontal-outline",
  game: "trophy-outline",
} as const;

/** Una entrada de la actividad (en «Actividad» y en Inicio). */
export function FeedEntry({ item: i }: { item: FeedItemDTO }) {
  const deck = "deck" in i ? i.deck : null;
  const openUser = (u: string) => router.push(`/u/${u}`);
  const who = (
    <T style={{ fontWeight: "700" }} onPress={() => openUser(i.actor.username)}>
      {i.actor.name}
    </T>
  );
  const link = (text: string, onPress: () => void) => (
    <T style={{ color: colors.accent }} onPress={onPress}>
      {text}
    </T>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <Pressable onPress={() => openUser(i.actor.username)}>
        <Avatar name={i.actor.name} />
      </Pressable>
      <View style={{ flex: 1, gap: 8 }}>
        <T>
          {i.type === "deck" && <>{who} ha publicado un mazo</>}
          {i.type === "like" && (
            <>
              A {who} le gusta un mazo de{" "}
              {link(`@${i.owner.username}`, () => openUser(i.owner.username))}
            </>
          )}
          {i.type === "comment" && <>{who} ha comentado</>}
          {i.type === "game" && (
            <>
              {who} {i.game.won ? "ha ganado" : "ha jugado"} una partida de {i.game.players}
              {i.game.won && i.game.deckName ? ` con ${i.game.deckName}` : ""}
              {!i.game.won && i.game.winner ? ` (ganó ${i.game.winner})` : ""}
              {i.game.group ? " en " : ""}
              {i.game.group &&
                link(i.game.group.name, () => router.push(`/groups/${i.game.group!.id}`))}
            </>
          )}
          {i.type === "trade" && (
            <>
              {who} ha cerrado un intercambio de {i.cards} {i.cards === 1 ? "carta" : "cartas"} con{" "}
              {link(`@${i.partner.username}`, () => openUser(i.partner.username))}
            </>
          )}
          <T variant="small"> · {ago(i.at)}</T>
        </T>
        {deck && (
          <Pressable
            onPress={() =>
              router.push(i.type === "comment" ? `/deck-comments/${deck.id}` : `/deck/${deck.id}`)
            }
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: 10,
              padding: 8,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.hover : colors.panel,
            })}
          >
            <CardThumb uri={deck.commanderCard?.imageUrl} width={44} name={deck.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: "600" }} numberOfLines={1}>
                {deck.name}
              </T>
              <T variant="small" numberOfLines={1}>
                {deck.commanders.join(" + ")}
              </T>
              {i.type === "comment" && (
                <T variant="small" style={{ fontStyle: "italic" }} numberOfLines={2}>
                  “{i.excerpt}”
                </T>
              )}
            </View>
          </Pressable>
        )}
        {i.type === "game" && link("Ver la partida", () => router.push(`/games/${i.game.id}`))}
      </View>
      <Ionicons name={ICON[i.type]} size={16} color={colors.text3} />
    </View>
  );
}
