import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import type { CardDTO, SavedDeckSummaryDTO } from "@/server/dto";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { ColorPips } from "./card-bits";
import { OptionRow, Sheet } from "./sheet";
import { toast } from "./toast";
import { Button, ErrorView, Loading, T } from "./ui";

/**
 * «Añadir a un mazo» desde la ficha de una carta: mis mazos (primero en los que cabe por colores)
 * y una copia al tocar uno. Si la carta puede ser comandante, también «Crear un mazo con ella».
 */
export function AddToDeckSheet({
  card,
  canBeCommander,
  open,
  onClose,
}: {
  card: CardDTO;
  canBeCommander: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const decks = useQuery({
    queryKey: ["decks"],
    queryFn: () => api<SavedDeckSummaryDTO[]>("/api/decks"),
    enabled: open,
  });
  const add = useMutation({
    mutationFn: (d: SavedDeckSummaryDTO) =>
      api<{ deckId: string; deckName: string }>(`/api/decks/${d.id}/cards`, {
        body: { oracleId: card.oracleId },
      }),
    onSuccess: (r) => {
      tapFeedback();
      onClose();
      toast(`Añadida a «${r.deckName}»`, {
        label: "Ver",
        onPress: () => router.push(`/deck/${r.deckId}`),
      });
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.invalidateQueries({ queryKey: ["deck", r.deckId] });
      qc.invalidateQueries({ queryKey: ["card", card.oracleId] });
    },
    onError: (e) => toast(e.message),
  });

  const fits = (d: SavedDeckSummaryDTO) =>
    card.colorIdentity.every((c) => (d.colorIdentity as readonly string[]).includes(c));
  const sorted = [...(decks.data ?? [])].sort(
    (a, b) => Number(fits(b)) - Number(fits(a)) || b.updatedAt.localeCompare(a.updatedAt),
  );
  const createDeck = () => {
    onClose();
    router.push(`/deck-new?commander=${card.oracleId}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Añadir «${card.name}» a un mazo`}
      footer={
        canBeCommander ? (
          <Button
            label="Crear un mazo con ella de comandante"
            icon="add"
            kind="secondary"
            onPress={createDeck}
          />
        ) : undefined
      }
    >
      {decks.isPending ? (
        <Loading />
      ) : decks.isError ? (
        <ErrorView error={decks.error} onRetry={() => decks.refetch()} />
      ) : sorted.length === 0 ? (
        <T variant="muted">
          Aún no tienes mazos.{" "}
          {canBeCommander
            ? "Crea uno con esta carta de comandante."
            : "Crea uno en la pestaña Mazos."}
        </T>
      ) : (
        <View style={{ gap: 2 }}>
          {sorted.map((d) => {
            const ok = fits(d);
            return (
              <OptionRow
                key={d.id}
                label={d.name}
                detail={
                  add.isPending && add.variables?.id === d.id
                    ? "Añadiendo…"
                    : ok
                      ? d.commanderNames.join(" + ")
                      : "Fuera de los colores del comandante"
                }
                disabled={!ok || add.isPending}
                onPress={() => add.mutate(d)}
                right={<ColorPips colors={d.colorIdentity} />}
              />
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
