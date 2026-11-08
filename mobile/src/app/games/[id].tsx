import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import type { GameDTO } from "@/server/social-dto";
import { memberLabel, playedOn } from "~/components/games";
import { Avatar, Card } from "~/components/social";
import { toast } from "~/components/toast";
import { Button, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { colors } from "~/lib/theme";
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

/** Una partida: quién ganó, jugadores con sus mazos y notas. */
export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const game = useQuery({
    queryKey: ["game", id],
    queryFn: () => api<GameDTO>(`/api/games/${id}`),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/games/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Partida borrada");
      qc.invalidateQueries({ queryKey: ["group"] });
      qc.invalidateQueries({ queryKey: ["games"] });
      router.back();
    },
    onError: (e) => toast(e.message),
  });

  if (game.isPending) return <Loading />;
  if (game.isError) return <ErrorView error={game.error} onRetry={() => game.refetch()} />;
  const g = game.data;
  const winner = g.players.find((p) => p.winner);
  return (
    <>
      <Stack.Screen options={{ title: g.group?.name ?? t("Partida", "Game") }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
          <T style={{ fontSize: 40, color: colors.warn }}>♛</T>
          <T variant="title" style={{ textAlign: "center" }}>
            {winner
              ? `${t("Ganó", "Won by")} ${winner.user ? memberLabel(winner.user) : winner.guestName}`
              : t("Sin ganador", "No winner")}
          </T>
          <T variant="muted" style={{ textAlign: "center" }}>
            {winner?.deckName ? `${t("con", "with")} ${winner.deckName} · ` : ""}
            {playedOn(g.playedAt)}
            {g.turns
              ? ` · ${g.turns} ${g.turns === 1 ? t("turno", "turn") : t("turnos", "turns")}`
              : ""}
          </T>
        </View>
        {g.group && (
          <Button
            label={g.group.name}
            kind="secondary"
            icon="people-outline"
            onPress={() => router.push(`/groups/${g.group!.id}`)}
          />
        )}
        <Card style={{ padding: 0, gap: 0 }}>
          {g.players.map((p) => (
            <View
              key={p.seat}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
              }}
            >
              <Avatar name={p.user?.name ?? p.guestName ?? "?"} image={p.user?.image ?? null} />
              <View style={{ flex: 1 }}>
                <T
                  style={{
                    fontWeight: p.winner ? "700" : "400",
                    color: p.user?.username ? colors.accent : colors.text,
                  }}
                  onPress={
                    p.user?.username ? () => router.push(`/u/${p.user!.username}`) : undefined
                  }
                >
                  {p.user ? memberLabel(p.user) : `${p.guestName} (${t("invitado", "guest")})`}
                </T>
                <T
                  variant="small"
                  numberOfLines={1}
                  style={p.deckId ? { color: colors.accent } : undefined}
                  onPress={p.deckId ? () => router.push(`/deck/${p.deckId}`) : undefined}
                >
                  {p.deckName || t("Mazo sin indicar", "Deck not specified")}
                  {p.commanderNames.length > 0 ? ` · ${p.commanderNames.join(" + ")}` : ""}
                </T>
              </View>
              {p.winner && (
                <T style={{ color: colors.warn, fontWeight: "700" }}>♛ {t("Ganador", "Winner")}</T>
              )}
            </View>
          ))}
        </Card>
        {g.notes ? (
          <Card>
            <T style={{ fontStyle: "italic" }}>“{g.notes}”</T>
          </Card>
        ) : null}
        {g.canDelete && (
          <Button
            label={t("Borrar la partida", "Delete the game")}
            kind="ghost"
            icon="trash-outline"
            busy={remove.isPending}
            onPress={() =>
              alert("¿Borrar la partida?", "Deja de contar en la clasificación.", [
                { text: t("Cancelar", "Cancel"), style: "cancel" },
                {
                  text: t("Borrar", "Delete"),
                  style: "destructive",
                  onPress: () => remove.mutate(),
                },
              ])
            }
          />
        )}
      </ScrollView>
    </>
  );
}
