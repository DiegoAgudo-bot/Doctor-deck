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
    p.status === "pending" ? (p.myTurn ? "Te toca responder" : `Le toca a @${partner}`) : null;

  const accept = () =>
    alert(
      "¿Aceptar el intercambio?",
      `Las cartas que das saldrán de tu colección y las que recibes entrarán en ella (y al revés en la de @${partner}). No se puede deshacer.\n\nSi después vuelves a importar un CSV antiguo de tu colección, las cartas que has dado volverían a aparecer.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Aceptar y mover las cartas", onPress: () => act.mutate({ action: "accept" }) },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: `Con @${partner}` }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T variant="h2" style={{ color: STATUS_COLOR[p.status] }}>
              {STATUS_LABEL[p.status]}
            </T>
            {p.version > 1 && <T variant="small">· versión {p.version}</T>}
          </View>
          <T variant="small">
            {p.isMine ? "La propusiste tú" : `Te la propuso @${partner}`}
            {p.version > 1 &&
              (p.lastByMe ? " · la última versión es tuya" : ` · última versión de @${partner}`)}
            {" · "}
            {ago(p.updatedAt)}
          </T>
          {who && <T style={{ fontWeight: "700" }}>{who}</T>}
        </View>
        {act.isError && <Banner text={act.error.message} />}
        {p.unavailable.length > 0 && (p.status === "pending" || p.status === "draft") && (
          <Banner
            text={`Algunas cartas ya no están en la lista para cambiar de quien las da.${p.myTurn ? " Contrapropón sin ellas o recházala." : ""}`}
          />
        )}
        {p.status === "accepted" && (
          <Banner
            tone="ok"
            text="Intercambio hecho: las cartas ya se han movido entre vuestras colecciones de Doctor Deck."
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
              label={`Enviar a @${partner}`}
              icon="paper-plane-outline"
              busy={busy}
              disabled={empty}
              onPress={() => act.mutate({ action: "send", lines: linesForApi(lines) })}
            />
            <Button
              label="Guardar"
              kind="secondary"
              disabled={busy || empty}
              onPress={() => act.mutate({ action: "save", lines: linesForApi(lines) })}
            />
            <Button
              label="Borrar borrador"
              kind="ghost"
              disabled={busy}
              onPress={() => act.mutate({ action: "delete" })}
            />
          </>
        )}
        {p.actions.respond && !countering && (
          <>
            <Button
              label="Aceptar"
              icon="checkmark"
              busy={busy}
              disabled={p.unavailable.length > 0}
              onPress={accept}
            />
            <Button
              label="Contraproponer"
              kind="secondary"
              disabled={busy}
              onPress={() => setCountering(true)}
            />
            <Button
              label="Rechazar"
              kind="danger"
              disabled={busy}
              onPress={() => act.mutate({ action: "reject" })}
            />
          </>
        )}
        {countering && (
          <>
            <Button
              label="Enviar contrapropuesta"
              icon="paper-plane-outline"
              busy={busy}
              disabled={empty}
              onPress={() => act.mutate({ action: "counter", lines: linesForApi(lines) })}
            />
            <Button
              label="Cancelar cambios"
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
            label="Retirar"
            kind="ghost"
            disabled={busy}
            onPress={() => act.mutate({ action: "cancel" })}
          />
        )}
      </ScrollView>
    </>
  );
}
