import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Switch, View } from "react-native";
import type { CardDTO, MyTradesDTO, TradePartnerDTO, TradeProposalSummaryDTO } from "@/server/dto";
import { CardPicker } from "~/components/games";
import { Card, SectionTitle } from "~/components/social";
import { toast } from "~/components/toast";
import { PartnerCard, STATUS_COLOR, STATUS_LABEL, TradeCardRow } from "~/components/trades";
import { Button, ErrorView, IconButton, Loading, Segmented, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { ago, euros } from "~/lib/format";
import { colors } from "~/lib/theme";

type Tab = "matches" | "proposals" | "wanted" | "offered";
const TABS: Tab[] = ["matches", "proposals", "wanted", "offered"];

/**
 * Intercambios: con quién cruzo, mis propuestas, mi lista de deseos (a mano y lo que falta de los
 * mazos que elija) y mis cartas para cambiar (copias libres). Sin pagos ni mensajes.
 */
export default function Trades() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t === params.tab) ?? "matches");
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["trades"], queryFn: () => api<MyTradesDTO>("/api/trades") });
  const partners = useQuery({
    queryKey: ["trade-matches"],
    queryFn: () => api<TradePartnerDTO[]>("/api/trades/matches"),
  });
  const proposals = useQuery({
    queryKey: ["proposals"],
    queryFn: () => api<TradeProposalSummaryDTO[]>("/api/trades/proposals"),
  });
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["trades"] });
    qc.invalidateQueries({ queryKey: ["trade-matches"] });
  };
  const run = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => {
      tapFeedback();
      refreshAll();
    },
    onError: (e) => toast(e.message),
  });
  const setWish = (card: CardDTO, quantity: number) =>
    run.mutate(() =>
      api(`/api/trades/wishes/${encodeURIComponent(card.oracleId)}`, {
        method: "PUT",
        body: { quantity },
      }),
    );
  const setKeep = (card: CardDTO, keep: boolean) =>
    run.mutate(() =>
      api(`/api/trades/keeps/${encodeURIComponent(card.oracleId)}`, {
        method: "PUT",
        body: { keep },
      }),
    );
  const setDeck = (id: string, inWishlist: boolean) =>
    run.mutate(() => api(`/api/decks/${id}`, { method: "PATCH", body: { inWishlist } }));
  const setPublic = (value: boolean) =>
    run.mutate(() =>
      api("/api/me/profile", { method: "PATCH", body: { tradesPublic: value } }).then(() =>
        qc.invalidateQueries({ queryKey: ["me"] }),
      ),
    );

  if (mine.isPending || partners.isPending || proposals.isPending) return <Loading />;
  const error = mine.error ?? partners.error ?? proposals.error;
  if (!mine.data || !partners.data || !proposals.data)
    return (
      <ErrorView
        error={error}
        onRetry={() => {
          mine.refetch();
          partners.refetch();
          proposals.refetch();
        }}
      />
    );
  const m = mine.data;
  const myTurn = proposals.data.filter((p) => p.myTurn).length;
  const wishValue = m.wishlist.reduce((n, w) => n + (w.price ?? 0) * w.quantity, 0);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || partners.isRefetching || proposals.isRefetching}
          onRefresh={() => {
            mine.refetch();
            partners.refetch();
            proposals.refetch();
          }}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={{ padding: 16, gap: 10 }}>
        {m.public ? (
          <T variant="small">
            Tus listas son públicas: salen en tu perfil y en los cruces de otros.{" "}
            <T variant="small" style={{ color: colors.accent }} onPress={() => setPublic(false)}>
              Hacerlas privadas
            </T>
          </T>
        ) : (
          <Card>
            <T style={{ fontWeight: "700" }}>Tus listas son privadas</T>
            <T variant="small">
              Hazlas públicas para cruzarlas con las de otros jugadores (y que ellos te encuentren).
            </T>
            <Button
              label="Hacerlas públicas"
              busy={run.isPending}
              onPress={() => setPublic(true)}
            />
          </Card>
        )}
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "matches", label: `Cruces ${partners.data.length || ""}`.trim() },
            { key: "proposals", label: myTurn ? `Propuestas · ${myTurn}` : "Propuestas" },
            { key: "wanted", label: "Busco" },
            { key: "offered", label: "Cambio" },
          ]}
        />
      </View>

      {tab === "matches" && (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {partners.data.length === 0 ? (
            <T variant="muted">
              {m.wishlist.length === 0
                ? "Añade cartas a tu lista de deseos (o mete un mazo en ella) para ver quién las tiene."
                : "Nadie con listas públicas tiene libre lo que buscas ni busca lo que te sobra. Prueba más adelante."}
            </T>
          ) : (
            partners.data.map((p) => <PartnerCard key={p.profile.username} p={p} />)
          )}
        </View>
      )}

      {tab === "proposals" && <ProposalList items={proposals.data} />}

      {tab === "wanted" && (
        <View>
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            <CardPicker
              label="Añadir a la lista de deseos"
              onPick={(card) =>
                setWish(
                  card,
                  (m.wishlist.find((w) => w.card.oracleId === card.oracleId)?.manual ?? 0) + 1,
                )
              }
            />
          </View>
          <SectionTitle right={wishValue > 0 ? <T variant="mono">≈ {euros(wishValue)}</T> : null}>
            Lo que busco · {m.wishlist.length}
          </SectionTitle>
          <View style={{ paddingHorizontal: 16 }}>
            {m.wishlist.length === 0 ? (
              <T variant="muted">Tu lista de deseos está vacía.</T>
            ) : (
              m.wishlist.map((w) => (
                <TradeCardRow
                  key={w.card.oracleId}
                  item={w}
                  right={
                    w.manual > 0 ? (
                      <IconButton
                        icon="close"
                        size={18}
                        color={colors.text3}
                        label={
                          w.forDecks > 0
                            ? `Quitar lo añadido a mano de ${w.card.name} (sigue por tus mazos)`
                            : `Quitar ${w.card.name}`
                        }
                        onPress={() => setWish(w.card, 0)}
                      />
                    ) : (
                      <T variant="small">mazo</T>
                    )
                  }
                />
              ))
            )}
          </View>
          <SectionTitle>Mazos en la lista</SectionTitle>
          <T variant="small" style={{ paddingHorizontal: 16 }}>
            Lo que te falta para los mazos marcados entra solo en tu lista de deseos (contando lo
            que ya usan tus otros mazos).
          </T>
          {m.decks.length === 0 ? (
            <T variant="muted" style={{ padding: 16 }}>
              No tienes mazos guardados.
            </T>
          ) : (
            m.decks.map((d) => (
              <View
                key={d.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T numberOfLines={1}>{d.name}</T>
                  <T variant="small" numberOfLines={1}>
                    {d.commanderNames.join(" + ")}
                  </T>
                </View>
                <Switch
                  value={d.inWishlist}
                  disabled={run.isPending}
                  onValueChange={(v) => setDeck(d.id, v)}
                  trackColor={{ true: colors.accent, false: colors.lineStrong }}
                  thumbColor={colors.text}
                />
              </View>
            ))
          )}
        </View>
      )}

      {tab === "offered" && (
        <View>
          <SectionTitle>
            {m.tradelistTotal > m.tradelist.length
              ? `Las ${m.tradelist.length} de más valor de ${m.tradelistTotal}`
              : `Para cambiar · ${m.tradelistTotal}`}
          </SectionTitle>
          <View style={{ paddingHorizontal: 16 }}>
            {m.tradelist.length === 0 ? (
              <T variant="muted">
                No tienes copias libres: todo lo que tienes está en tus mazos (o aún no has añadido
                tu colección).
              </T>
            ) : (
              m.tradelist.map((t) => (
                <TradeCardRow
                  key={t.card.oracleId}
                  item={t}
                  right={
                    <T
                      variant="small"
                      style={{ color: colors.accent }}
                      onPress={() => setKeep(t.card, true)}
                    >
                      No la cambio
                    </T>
                  }
                />
              ))
            )}
          </View>
          <SectionTitle>No las cambio · {m.keep.length}</SectionTitle>
          <T variant="small" style={{ paddingHorizontal: 16 }}>
            Para cambiar salen solas tus copias libres (las que no usa ningún mazo), sin tierras
            básicas. Las que marques aquí no salen.
          </T>
          {m.keep.map((c) => (
            <View
              key={c.oracleId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <T
                style={{ flex: 1 }}
                numberOfLines={1}
                onPress={() => router.push(`/card/${c.oracleId}`)}
              >
                {c.name}
              </T>
              <T variant="small" style={{ color: colors.accent }} onPress={() => setKeep(c, false)}>
                Sí la cambio
              </T>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** Mis propuestas de intercambio: primero las que me toca responder. */
function ProposalList({ items }: { items: TradeProposalSummaryDTO[] }) {
  if (items.length === 0) {
    return (
      <T variant="muted" style={{ paddingHorizontal: 16 }}>
        Ninguna propuesta. Desde un cruce o desde el perfil de alguien con listas públicas, pulsa
        «Proponer»: la calculadora te propone qué cambiar, cuadrado por valor.
      </T>
    );
  }
  const sorted = [...items].sort((a, b) => Number(b.myTurn) - Number(a.myTurn));
  return (
    <View>
      {sorted.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/trades/proposals/${p.id}`)}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            backgroundColor: pressed ? colors.hover : "transparent",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T style={{ fontWeight: "700", flex: 1 }}>@{p.partner.username}</T>
            <T
              variant="small"
              style={{ color: p.myTurn ? colors.warn : STATUS_COLOR[p.status], fontWeight: "700" }}
            >
              {p.myTurn ? "Te toca" : STATUS_LABEL[p.status]}
            </T>
          </View>
          <T variant="small">
            Das {p.giveCount} · recibes {p.getCount} · {euros(p.balance.giveValue)} ↔{" "}
            {euros(p.balance.getValue)}
          </T>
          <T variant="small">
            {p.isMine ? "Enviada por ti" : "Recibida"} · {ago(p.updatedAt)}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
