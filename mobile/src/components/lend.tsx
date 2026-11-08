import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import type { CardDTO } from "@/server/dto";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { colors } from "~/lib/theme";
import { CardThumb } from "./card-bits";
import { CardPicker } from "./games";
import { Sheet } from "./sheet";
import { Stepper } from "./stepper";
import { toast } from "./toast";
import { Banner, Button, Field, T } from "./ui";
import { t } from "~/lib/i18n";

/**
 * Apuntar un préstamo: a alguien con cuenta (`@ana`, le llega un aviso) o a un nombre. Solo se
 * prestan copias libres (el servidor lo comprueba). Sin `card`, se elige la carta aquí.
 */
export function LendSheet({
  card: initial,
  open,
  onClose,
}: {
  card: CardDTO | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [card, setCard] = useState<CardDTO | null>(initial);
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    setCard(initial);
    setQuantity(1);
  }, [initial, open]);

  const save = useMutation({
    mutationFn: () =>
      api("/api/loans", {
        body: { oracleId: card!.oracleId, quantity, to: to.trim(), ...(note ? { note } : {}) },
      }),
    onSuccess: () => {
      tapFeedback();
      toast(`Prestada ${card?.name} a ${to.trim()}`);
      setTo("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: ["card"] });
      onClose();
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Prestar una carta", "Lend a card")}
      footer={
        <Button
          label={t("Apuntar préstamo", "Record loan")}
          icon="hand-left-outline"
          busy={save.isPending}
          disabled={!card || !to.trim()}
          onPress={() => save.mutate()}
        />
      }
    >
      {save.isError && <Banner text={save.error.message} />}
      {card ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CardThumb uri={card.imageUrl} width={56} name={card.name} />
          <View style={{ flex: 1, gap: 4 }}>
            <T style={{ fontWeight: "700" }}>{card.name}</T>
            {!initial && (
              <T variant="small" style={{ color: colors.accent }} onPress={() => setCard(null)}>
                {t("Otra carta", "Another card")}
              </T>
            )}
          </View>
          <Stepper value={quantity} min={1} max={99} onChange={setQuantity} />
        </View>
      ) : (
        <CardPicker label={t("Carta", "Card")} onPick={setCard} />
      )}
      <Field
        label={t("A quién", "To whom")}
        placeholder={t("@usuario o un nombre", "@username or a name")}
        value={to}
        maxLength={80}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setTo}
      />
      <T variant="small">
        {t(
          "Con @usuario le llega un aviso y lo ve en sus préstamos. Mientras no la devuelva, cuenta como ocupada en tu colección.",
          "With @username they get a notification and see it in their loans. Until it's returned, it counts as in use in your collection.",
        )}
      </T>
      <Field
        label={t("Nota (opcional)", "Note (optional)")}
        placeholder={t("Para el torneo del sábado…", "For Saturday's tournament…")}
        value={note}
        maxLength={500}
        onChangeText={setNote}
      />
    </Sheet>
  );
}
