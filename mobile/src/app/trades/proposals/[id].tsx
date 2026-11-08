import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import type { TradeProposalDTO } from "@/server/dto";
import { TradeEditor } from "~/components/trade-editor";
import { STATUS_COLOR, STATUS_LABEL } from "~/components/trades";
import { toast } from "~/components/toast";
import { Banner, Button, ErrorView, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { ago } from "~/lib/format";
import { linesForApi, toLines, type TradeLine } from "~/lib/trade-lines";
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

type Action =
  | { action: "save" | "send" | "counter"; lines: ReturnType<typeof linesForApi> }
  | { action: "accept" | "reject" | "cancel" | "delete" };

/** Una propuesta de intercambio: ver, editar el borrador, contraproponer, aceptar o rechazar. */
export default function Proposal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const proposal = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => api<TradeProposalDTO>(`/api/trades/proposals/${encodeURIComponent(id)}`),
  });
  const [lines, setLines] = useState<TradeLine[]>([]);
  /** Contraproponiendo: editando las líneas de una propuesta que me toca responder. */
  const [countering, setCountering] = useState(false);
  useEffect(() => {
    if (proposal.data) {
      setLines(toLines(proposal.data.give, proposal.data.get));
      setCountering(false);
    }
  }, [proposal.data]);

  const act = useMutation({
    mutationFn: (body: Action) =>
      api<TradeProposalDTO | { deleted: true }>(`/api/trades/proposals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: (res, body) => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
      if ("deleted" in res) {
        toast("Borrador borrado");
        router.back();
        return;
      }
      tapFeedback();
      qc.setQueryData(["proposal", id], res);
      if (body.action === "accept") {
        qc.invalidateQueries({ queryKey: ["collection"] });
        toast("Intercambio hecho: las cartas ya están en vuestras colecciones");
      } else if (body.action === "send" || body.action === "counter") {
        toast(`Enviada a @${res.partner.username}`);
      }
    },
  });

  if (proposal.isPending) return <Loading />;
  if (proposal.isError)
    return <ErrorView error={proposal.error} onRetry={() => proposal.refetch()} />;
  const p = proposal.data;
  const partner = p.partner.username;
  const editing = p.actions.edit || countering;
  const empty = !lines.some((l) => l.quantity > 0);
  const busy = act.isPending;
  const who =
    p.status === "pending"
      ? p.myTurn
        ? t("Te toca responder", "Your turn to answer")
        : t(`Le toca a @${partner}`, `@${partner}'s turn`)
      : null;

  const accept = () =>
    alert(
      t("¿Aceptar el intercambio?", "Accept the trade?"),
      t(
        `Las cartas que das saldrán de tu colección y las que recibes entrarán en ella (y al revés en la de @${partner}). No se puede deshacer.\n\nSi después vuelves a importar un CSV antiguo de tu colección, las cartas que has dado volverían a aparecer.`,
        `The cards you give will leave your collection and the ones you get will enter it (and the other way round for @${partner}). This can't be undone.\n\nIf you later re-import an old CSV of your collection, the cards you gave would reappear.`,
      ),
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        {
          text: t("Aceptar y mover las cartas", "Accept and move the cards"),
          onPress: () => act.mutate({ action: "accept" }),
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: t(`Con @${partner}`, `With @${partner}`) }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T variant="h2" style={{ color: STATUS_COLOR[p.status] }}>
              {STATUS_LABEL[p.status]}
            </T>
            {p.version > 1 && (
              <T variant="small">
                · {t("versión", "version")} {p.version}
              </T>
            )}
          </View>
          <T variant="small">
            {p.isMine
              ? t("La propusiste tú", "You proposed it")
              : t(`Te la propuso @${partner}`, `Proposed by @${partner}`)}
            {p.version > 1 &&
              (p.lastByMe
                ? t(" · la última versión es tuya", " · the latest version is yours")
                : t(` · última versión de @${partner}`, ` · latest version by @${partner}`))}
            {" · "}
            {ago(p.updatedAt)}
          </T>
          {who && <T style={{ fontWeight: "700" }}>{who}</T>}
        </View>
        {act.isError && <Banner text={act.error.message} />}
        {p.unavailable.length > 0 && (p.status === "pending" || p.status === "draft") && (
          <Banner
            text={t(
              `Algunas cartas ya no están en la lista para cambiar de quien las da.${p.myTurn ? " Contrapropón sin ellas o recházala." : ""}`,
              `Some cards are no longer on the giver's trade list.${p.myTurn ? " Counter without them or reject it." : ""}`,
            )}
          />
        )}
        {p.status === "accepted" && (
          <Banner
            tone="ok"
            text={t(
              "Intercambio hecho: las cartas ya se han movido entre vuestras colecciones de Doctor Deck.",
              "Trade done: the cards have moved between your Doctor Deck collections.",
            )}
          />
        )}
        <TradeEditor
          partner={partner}
          lines={lines}
          onChange={editing ? setLines : undefined}
          myCopies={p.myCopies}
          theirCopies={p.theirCopies}
          unavailable={p.unavailable}
        />

        {p.actions.edit && (
          <>
            <Button
              label={t(`Enviar a @${partner}`, `Send to @${partner}`)}
              icon="paper-plane-outline"
              busy={busy}
              disabled={empty}
              onPress={() => act.mutate({ action: "send", lines: linesForApi(lines) })}
            />
            <Button
              label={t("Guardar", "Save")}
              kind="secondary"
              disabled={busy || empty}
              onPress={() => act.mutate({ action: "save", lines: linesForApi(lines) })}
            />
            <Button
              label={t("Borrar borrador", "Delete draft")}
              kind="ghost"
              disabled={busy}
              onPress={() => act.mutate({ action: "delete" })}
            />
          </>
        )}
        {p.actions.respond && !countering && (
          <>
            <Button
              label={t("Aceptar", "Accept")}
              icon="checkmark"
              busy={busy}
              disabled={p.unavailable.length > 0}
              onPress={accept}
            />
            <Button
              label={t("Contraproponer", "Counter")}
              kind="secondary"
              disabled={busy}
              onPress={() => setCountering(true)}
            />
            <Button
              label={t("Rechazar", "Reject")}
              kind="danger"
              disabled={busy}
              onPress={() => act.mutate({ action: "reject" })}
            />
          </>
        )}
        {countering && (
          <>
            <Button
              label={t("Enviar contrapropuesta", "Send counter-offer")}
              icon="paper-plane-outline"
              busy={busy}
              disabled={empty}
              onPress={() => act.mutate({ action: "counter", lines: linesForApi(lines) })}
            />
            <Button
              label={t("Cancelar cambios", "Discard changes")}
              kind="secondary"
              disabled={busy}
              onPress={() => {
                setLines(toLines(p.give, p.get));
                setCountering(false);
              }}
            />
          </>
        )}
        {p.actions.cancel && !countering && (
          <Button
            label={t("Retirar", "Withdraw")}
            kind="ghost"
            disabled={busy}
            onPress={() => act.mutate({ action: "cancel" })}
          />
        )}
      </ScrollView>
    </>
  );
}
