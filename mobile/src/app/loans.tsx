import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { LoanDTO, LoansDTO } from "@/server/social-dto";
import { CardThumb } from "~/components/card-bits";
import { playedOn } from "~/components/games";
import { LendSheet } from "~/components/lend";
import { SectionTitle } from "~/components/social";
import { toast } from "~/components/toast";
import { Button, Chip, ErrorView, Fab, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { colors, radius } from "~/lib/theme";
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

/** Lo que he prestado y lo que me han prestado (con los devueltos si se piden). */
export default function Loans() {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const [lending, setLending] = useState(false);
  const loans = useQuery({
    queryKey: ["loans", all],
    queryFn: () => api<LoansDTO>(`/api/loans${all ? "?all=1" : ""}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["collection"] });
  };
  const returned = useMutation({
    mutationFn: (l: LoanDTO) =>
      api(`/api/loans/${l.id}`, { method: "PATCH", body: { action: "returned" } }),
    onSuccess: () => {
      tapFeedback();
      toast("Marcado como devuelto");
      refresh();
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (l: LoanDTO) => api(`/api/loans/${l.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast("Préstamo borrado");
      refresh();
    },
    onError: (e) => toast(e.message),
  });

  const row = (l: LoanDTO, lent: boolean) => {
    const who = lent
      ? l.borrower
        ? `@${l.borrower.username ?? l.borrower.name}`
        : (l.borrowerName ?? "")
      : `@${l.lender.username ?? l.lender.name}`;
    return (
      <View
        key={l.id}
        style={{
          flexDirection: "row",
          gap: 12,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: radius.lg,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: l.returnedAt ? 0.6 : 1,
        }}
      >
        <Pressable onPress={() => l.card && router.push(`/card/${l.card.oracleId}`)}>
          <CardThumb uri={l.card?.imageUrl} width={52} name={l.name} />
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontWeight: "700" }} numberOfLines={1}>
            {l.quantity > 1 ? `${l.quantity}× ` : ""}
            {l.name}
          </T>
          <T variant="small">
            {lent ? t("A ", "To ") : t("De ", "From ")}
            {who} · {playedOn(l.createdAt)}
          </T>
          {l.note ? (
            <T variant="small" style={{ fontStyle: "italic" }} numberOfLines={2}>
              “{l.note}”
            </T>
          ) : null}
          {l.returnedAt ? (
            <T variant="small" style={{ color: colors.in }}>
              {t("Devuelta el", "Returned on")} {playedOn(l.returnedAt)}
            </T>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Chip
                label={t("Devuelta", "Returned")}
                icon="checkmark"
                onPress={() => returned.mutate(l)}
              />
              {lent && (
                <Chip
                  label={t("Borrar", "Delete")}
                  icon="trash-outline"
                  onPress={() =>
                    alert("¿Borrar el préstamo?", "Para los apuntados por error.", [
                      { text: t("Cancelar", "Cancel"), style: "cancel" },
                      {
                        text: t("Borrar", "Delete"),
                        style: "destructive",
                        onPress: () => remove.mutate(l),
                      },
                    ])
                  }
                />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {loans.isPending ? (
        <Loading />
      ) : loans.isError && !loans.data ? (
        <ErrorView error={loans.error} onRetry={() => loans.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={loans.isRefetching}
              onRefresh={() => loans.refetch()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <View style={{ flexDirection: "row", gap: 6, padding: 16, paddingBottom: 0 }}>
            <Chip
              label={t("Sin devolver", "Not returned")}
              active={!all}
              onPress={() => setAll(false)}
            />
            <Chip label={t("Todos", "All")} active={all} onPress={() => setAll(true)} />
          </View>
          <SectionTitle>
            {t("He prestado", "Lent out")} · {loans.data?.lent.length ?? 0}
          </SectionTitle>
          {loans.data?.lent.length ? (
            loans.data.lent.map((l) => row(l, true))
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <T variant="muted">
                {t(
                  "No tienes nada prestado. Lo que prestes cuenta como ocupado en tu colección hasta que te lo devuelvan.",
                  "You haven't lent anything. What you lend counts as in use in your collection until it's returned.",
                )}
              </T>
              <Button
                label={t("Prestar una carta", "Lend a card")}
                kind="secondary"
                icon="hand-left-outline"
                onPress={() => setLending(true)}
              />
            </View>
          )}
          <SectionTitle>
            {t("Me han prestado", "Borrowed")} · {loans.data?.borrowed.length ?? 0}
          </SectionTitle>
          {loans.data?.borrowed.length ? (
            loans.data.borrowed.map((l) => row(l, false))
          ) : (
            <T variant="muted" style={{ paddingHorizontal: 16 }}>
              {t("Nadie te ha prestado nada.", "Nobody has lent you anything.")}
            </T>
          )}
        </ScrollView>
      )}
      <Fab
        icon="add"
        label={t("Prestar una carta", "Lend a card")}
        onPress={() => setLending(true)}
      />
      <LendSheet card={null} open={lending} onClose={() => setLending(false)} />
    </View>
  );
}
