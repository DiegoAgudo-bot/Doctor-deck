import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { CommunityDeckDTO } from "@/server/dto";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { euros } from "~/lib/format";
import { colors } from "~/lib/theme";
import { DeckTile } from "./deck-tile";
import { toast } from "./toast";
import { T } from "./ui";

/** Un mazo de la comunidad: portada, cuánto tengo, lo que cuesta lo que falta y «me gusta». */
export function CommunityDeck({ deck }: { deck: CommunityDeckDTO }) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(deck.liked);
  const [likes, setLikes] = useState(deck.likes);
  const like = useMutation({
    mutationFn: (on: boolean) =>
      api<{ likes: number; liked: boolean }>(`/api/decks/${deck.id}/like`, {
        method: on ? "POST" : "DELETE",
      }),
    onMutate: (on) => {
      tapFeedback();
      setLiked(on);
      setLikes((n) => n + (on ? 1 : -1));
    },
    onSuccess: (r) => {
      setLikes(r.likes);
      qc.invalidateQueries({ queryKey: ["deck", deck.id] });
    },
    onError: (e, on) => {
      setLiked(!on);
      setLikes(deck.likes);
      toast(e.message);
    },
  });
  const o = deck.ownership;
  return (
    <View style={{ gap: 6 }}>
      <DeckTile deck={deck} owner={deck.owner.username ?? deck.owner.name} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
        <T variant="small" style={{ color: o.percent >= 80 ? colors.in : colors.text2 }}>
          Tienes el {Math.round(o.percent)} %
        </T>
        {o.toBuy > 0 && (
          <T variant="small">
            · faltan {o.toBuy} ({euros(o.cost)})
          </T>
        )}
        {deck.bracket ? <T variant="small">· B{deck.bracket}</T> : null}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? "Quitar me gusta" : "Me gusta"}
          hitSlop={10}
          onPress={() => like.mutate(!liked)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={18}
            color={liked ? colors.out : colors.text3}
          />
          <T variant="small">{likes}</T>
        </Pressable>
      </View>
    </View>
  );
}
