import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SectionList, Share, View } from "react-native";
import type {
  AnalyzeResponse,
  CardDTO,
  DeckCardDTO,
  DeckViewDTO,
  OwnershipItemDTO,
  SwapDTO,
} from "@/server/dto";
import { CardThumb, ColorPips, ManaCost } from "~/components/card-bits";
import { toast } from "~/components/toast";
import {
  Banner,
  Button,
  Chip,
  ErrorView,
  IconButton,
  Loading,
  Segmented,
  T,
} from "~/components/ui";
import { api, artUri } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { euros } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

type Tab = "list" | "missing" | "changes" | "stats";
type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;

const TYPE_ORDER: [string, string][] = [
  ["Creature", "Criaturas"],
  ["Planeswalker", "Planeswalkers"],
  ["Battle", "Batallas"],
  ["Instant", "Instantáneos"],
  ["Sorcery", "Conjuros"],
  ["Artifact", "Artefactos"],
  ["Enchantment", "Encantamientos"],
  ["Land", "Tierras"],
];
const typeGroup = (typeLine: string) => {
  const front = typeLine.split("//")[0] ?? typeLine;
  return TYPE_ORDER.find(([t]) => front.includes(t))?.[1] ?? "Otras";
};

const STATUS_COLOR: Record<OwnershipItemDTO["status"], string> = {
  owned: colors.owned,
  in_other_decks: colors.inuse,
  missing: colors.missing,
  basic: colors.text3,
};

/** Un mazo: portada, lista por tipos, lo que me falta, cambios sugeridos y estadísticas. */
export default function DeckScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<Tab>(initialTab === "missing" ? "missing" : "list");
  const deck = useQuery({
    queryKey: ["deck", id],
    queryFn: () => api<DeckViewDTO>(`/api/decks/${id}`),
  });
  const d = deck.data;
  const analysis = useQuery({
    queryKey: ["analysis", id, d?.updatedAt],
    enabled: Boolean(d),
    staleTime: 5 * 60_000,
    // Al aplicar un cambio se vuelve a analizar: mientras, se sigue viendo lo de antes.
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<AnalyzeResponse>("/api/analyze", {
        body: {
          input: d!.input,
          commanders: d!.commanders,
          locked: d!.locked,
          excluded: d!.excluded,
          ...(d!.theme ? { theme: d!.theme } : {}),
          ...(d!.isMine ? { deckId: d!.id } : {}),
          ...(d!.targetBracket ? { targetBracket: d!.targetBracket } : {}),
        },
      }),
  });

  const actions = useDeckActions(d);

  if (deck.isPending) return <Loading />;
  if (deck.isError || !d) return <ErrorView error={deck.error} onRetry={() => deck.refetch()} />;
  const a = analysis.data?.status === "ok" ? analysis.data : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: d.name,
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              {!d.isMine && (
                <IconButton
                  icon="copy-outline"
                  label="Guardar una copia"
                  onPress={() => actions.copy.mutate()}
                />
              )}
              <IconButton
                icon="share-social-outline"
                label="Compartir"
                onPress={() =>
                  Share.share({ message: `${d.name} · https://doctordeck.app/decks/${d.id}` })
                }
              />
              <IconButton
                icon="open-outline"
                label="Abrir en la web"
                onPress={() => router.push(`/web?path=${encodeURIComponent(`/decks/${d.id}`)}`)}
              />
            </View>
          ),
        }}
      />
      <DeckBody
        deck={d}
        analysis={a}
        tab={tab}
        setTab={setTab}
        loading={analysis.isPending}
        refreshing={analysis.isPlaceholderData || analysis.isFetching}
        error={analysis.error}
        retry={() => analysis.refetch()}
        needsCommander={analysis.data?.status === "needs_commander"}
        actions={actions}
      />
    </>
  );
}

/**
 * Lo que se puede hacer con un mazo desde la app: aplicar o descartar cambios, quitar cartas,
 * marcarlo para la lista de deseos (los míos) y guardar una copia (los de otros). Después se
 * vuelve a pedir el mazo, y con él el análisis.
 */
function useDeckActions(d: DeckViewDTO | undefined) {
  const qc = useQueryClient();
  const reload = () => {
    qc.invalidateQueries({ queryKey: ["deck", d?.id] });
    qc.invalidateQueries({ queryKey: ["decks"] });
    qc.invalidateQueries({ queryKey: ["collection"] });
  };
  const changeCards = (changes: { oracleId: string; delta: number }[]) =>
    api(`/api/decks/${d!.id}/cards`, { method: "PATCH", body: { changes } });

  const apply = useMutation({
    mutationFn: (swaps: SwapDTO[]) =>
      changeCards(
        swaps.flatMap((s) => [
          { oracleId: s.out.card.oracleId, delta: -1 },
          { oracleId: s.in.card.oracleId, delta: 1 },
        ]),
      ),
    onSuccess: (_r, swaps) => {
      tapFeedback();
      toast(
        swaps.length === 1
          ? `Hecho: sale ${swaps[0]!.out.card.name}, entra ${swaps[0]!.in.card.name}`
          : `${swaps.length} cambios aplicados`,
      );
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const discard = useMutation({
    mutationFn: (swap: SwapDTO) =>
      api("/api/decks", {
        body: {
          id: d!.id,
          name: d!.name,
          input: d!.input,
          commanders: d!.commanders,
          locked: d!.locked,
          excluded: [...new Set([...d!.excluded, swap.in.card.oracleId])],
          ...(d!.theme ? { theme: d!.theme } : {}),
        },
      }),
    onSuccess: (_r, swap) => {
      toast(`No se volverá a proponer ${swap.in.card.name}`);
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (card: CardDTO) => changeCards([{ oracleId: card.oracleId, delta: -1 }]),
    onSuccess: (_r, card) => {
      tapFeedback();
      toast(`Quitada ${card.name}`);
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const wishlist = useMutation({
    mutationFn: (inWishlist: boolean) =>
      api(`/api/decks/${d!.id}`, { method: "PATCH", body: { inWishlist } }),
    onSuccess: (_r, on) => {
      toast(on ? "Lo que falta va a tu lista de deseos" : "Fuera de tu lista de deseos");
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const copy = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/decks", {
        body: {
          name: d!.name,
          input: d!.input,
          commanders: d!.commanders,
          visibility: "private",
          ...(d!.theme ? { theme: d!.theme } : {}),
        },
      }),
    onSuccess: (r) => {
      toast("Copia guardada en tus mazos (privada)");
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.replace(`/deck/${r.id}`);
    },
    onError: (e) => toast(e.message),
  });
  return { apply, discard, remove, wishlist, copy };
}
type DeckActions = ReturnType<typeof useDeckActions>;

function DeckBody({
  deck,
  analysis: a,
  tab,
  setTab,
  loading,
  refreshing,
  error,
  retry,
  needsCommander,
  actions,
}: {
  deck: DeckViewDTO;
  analysis: Analysis | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  retry: () => void;
  needsCommander: boolean;
  actions: DeckActions;
}) {
  const mine = deck.isMine;
  const busy = actions.apply.isPending || actions.discard.isPending || actions.remove.isPending;
  // Hasta que llega el análisis nuevo, los cambios que se ven pueden estar ya aplicados.
  const waiting = busy || refreshing;
  const ownership = useMemo(
    () => new Map((a?.ownership.items ?? []).map((i) => [i.card.oracleId, i])),
    [a],
  );
  const sections = useMemo(() => {
    if (!a) return [];
    if (tab === "list") {
      const groups = new Map<string, DeckCardDTO[]>();
      for (const c of a.cards) {
        const g = typeGroup(c.card.typeLine);
        groups.set(g, [...(groups.get(g) ?? []), c]);
      }
      const order = ["Comandante", ...TYPE_ORDER.map(([, l]) => l), "Otras"];
      const commanderRows = a.commanders.map((card) => ({
        card,
        quantity: 1,
      }));
      return [
        { title: a.commanders.length > 1 ? "Comandantes" : "Comandante", data: commanderRows },
        ...order
          .filter((g) => groups.has(g))
          .map((g) => {
            const rows = (groups.get(g) ?? []).sort(
              (x, y) => x.card.cmc - y.card.cmc || x.card.name.localeCompare(y.card.name),
            );
            return {
              title: `${g} (${rows.reduce((s, r) => s + r.quantity, 0)})`,
              data: rows.map((r) => ({ card: r.card, quantity: r.quantity })),
            };
          }),
      ];
    }
    if (tab === "missing") {
      const toBuy = a.ownership.items.filter((i) => i.toBuy > 0);
      const other = a.ownership.items.filter((i) => i.fromOtherDecks > 0 && i.toBuy === 0);
      return [
        {
          title: `Te faltan (${toBuy.reduce((s, i) => s + i.toBuy, 0)})`,
          data: toBuy.map((i) => ({ card: i.card, quantity: i.toBuy, price: i.price })),
        },
        ...(other.length > 0
          ? [
              {
                title: `En otros mazos (${other.length})`,
                data: other.map((i) => ({
                  card: i.card,
                  quantity: i.fromOtherDecks,
                  note: i.usedIn.join(", "),
                })),
              },
            ]
          : []),
      ];
    }
    return [];
  }, [a, tab]);

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Cover deck={deck} analysis={a} />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Segmented<Tab>
          options={[
            { key: "list", label: "Lista" },
            {
              key: "missing",
              label:
                a && a.ownership.totals.toBuy > 0
                  ? `Me falta ${a.ownership.totals.toBuy}`
                  : "Me falta",
            },
            {
              key: "changes",
              label: a && a.swaps.length > 0 ? `Cambios ${a.swaps.length}` : "Cambios",
            },
            { key: "stats", label: "Datos" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {(refreshing || busy) && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <T variant="small">{busy ? "Guardando…" : "Recalculando…"}</T>
          </View>
        )}
        {tab === "list" && mine && a && (
          <T variant="small">Mantén pulsada una carta para quitarla del mazo.</T>
        )}
        {tab === "changes" && mine && a && a.swaps.length > 1 && (
          <Button
            label={`Aplicar los ${a.swaps.length} cambios`}
            icon="checkmark-done"
            disabled={waiting}
            onPress={() =>
              Alert.alert(
                `¿Aplicar los ${a.swaps.length} cambios?`,
                "Se guardan en el mazo. Puedes deshacerlos editando la lista.",
                [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Aplicar", onPress: () => actions.apply.mutate(a.swaps) },
                ],
              )
            }
          />
        )}
        {a?.edhrec.warning && <Banner text={a.edhrec.warning} />}
        {needsCommander && (
          <>
            <Banner text="Este mazo no dice cuál es el comandante: elígelo en la web." />
            <Button
              label="Elegir comandante"
              kind="secondary"
              onPress={() =>
                router.push(
                  `/web?path=${encodeURIComponent(`/decks/${deck.id}`)}&title=${encodeURIComponent(deck.name)}`,
                )
              }
            />
          </>
        )}
        {tab === "missing" && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T style={{ flex: 1 }}>
              Comprar lo que falta:{" "}
              <T style={{ fontWeight: "700" }}>{euros(a.ownership.totals.cost)}</T>
            </T>
            {mine && (
              <Chip
                label="En deseos"
                icon={deck.inWishlist ? "heart" : "heart-outline"}
                active={deck.inWishlist}
                accessibilityLabel={
                  deck.inWishlist
                    ? "Quitar lo que falta de tu lista de deseos"
                    : "Añadir lo que falta a tu lista de deseos"
                }
                onPress={() => actions.wishlist.mutate(!deck.inWishlist)}
              />
            )}
            <Button
              label="Compartir"
              kind="secondary"
              icon="share-outline"
              onPress={() =>
                Share.share({
                  message: a.ownership.items
                    .filter((i) => i.toBuy > 0)
                    .map((i) => `${i.toBuy} ${i.card.name}`)
                    .join("\n"),
                })
              }
            />
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <Loading label="Analizando con EDHREC…" />
      </View>
    );
  }
  if (error && !a) {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <ErrorView error={error} onRetry={retry} />
      </View>
    );
  }

  if (tab === "changes" || tab === "stats") {
    return (
      <SectionList
        sections={[{ title: "", data: tab === "changes" ? (a?.swaps ?? []) : [] }]}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <>
            {header}
            {tab === "stats" && a && <Stats analysis={a} />}
            {tab === "changes" && a && a.swaps.length === 0 && (
              <T variant="muted" style={{ paddingHorizontal: 16 }}>
                Con tu colección no hay cambios que lo mejoren ahora mismo. Añade cartas a tu
                colección o mira «Me falta» para ver qué comprar.
              </T>
            )}
          </>
        }
        renderSectionHeader={() => null}
        renderItem={({ item }) => (
          <SwapRow
            swap={item}
            actions={
              mine
                ? {
                    apply: () => actions.apply.mutate([item]),
                    discard: () => actions.discard.mutate(item),
                    disabled: waiting,
                  }
                : undefined
            }
          />
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row, i) => `${row.card.oracleId}-${i}`}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderSectionHeader={({ section }) => (
        <T variant="label" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
          {section.title}
        </T>
      )}
      renderItem={({ item }) => (
        <CardLine
          card={item.card}
          quantity={item.quantity}
          dot={ownership.get(item.card.oracleId)?.status}
          right={"price" in item && item.price != null ? euros(item.price as number) : undefined}
          note={"note" in item ? (item.note as string) : undefined}
          onLongPress={
            mine && tab === "list" && !a?.commanders.some((c) => c.oracleId === item.card.oracleId)
              ? () =>
                  Alert.alert(`¿Quitar ${item.card.name}?`, "Se quita una copia del mazo.", [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Quitar",
                      style: "destructive",
                      onPress: () => actions.remove.mutate(item.card),
                    },
                  ])
              : undefined
          }
        />
      )}
    />
  );
}

function Cover({ deck, analysis: a }: { deck: DeckViewDTO; analysis: Analysis | null }) {
  const commander = a?.commanders[0];
  const art = artUri(commander?.imageUrl);
  const t = a?.ownership.totals;
  const pct = t && t.cards > 0 ? Math.round((t.have / t.cards) * 100) : null;
  return (
    <View>
      {art ? (
        <Image
          source={{ uri: art }}
          style={{ height: 150 }}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={{ height: 40 }} />
      )}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 6 }}>
        <T variant="title">{deck.name}</T>
        <T variant="small">
          {deck.commanderNames.join(" + ")}
          {!deck.isMine && deck.owner.username ? ` · @${deck.owner.username}` : ""}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {a && (
            <ColorPips
              colors={a.commanders
                .flatMap((c) => c.colorIdentity)
                .filter((c, i, l) => l.indexOf(c) === i)}
              size={12}
            />
          )}
          <Pill text={`${a?.totalCards ?? deck.cardCount} cartas`} />
          {a && <Pill text={`Bracket ${a.bracket.bracket}`} />}
          {pct !== null && <Pill text={`Tienes ${pct} %`} color={colors.owned} />}
          {t && t.toBuy > 0 && (
            <Pill text={`Faltan ${t.toBuy} · ${euros(t.cost)}`} color={colors.warn} />
          )}
        </View>
      </View>
    </View>
  );
}

const Pill = ({ text, color = colors.text2 }: { text: string; color?: string }) => (
  <View
    style={{
      borderWidth: 1,
      borderColor: colors.lineStrong,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    }}
  >
    <T variant="small" style={{ color }}>
      {text}
    </T>
  </View>
);

function CardLine({
  card,
  quantity,
  dot,
  right,
  note,
  onLongPress,
}: {
  card: CardDTO;
  quantity: number;
  dot?: OwnershipItemDTO["status"] | undefined;
  right?: string | undefined;
  note?: string | undefined;
  onLongPress?: (() => void) | undefined;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/card/${card.oracleId}`)}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: pressed ? colors.hover : "transparent",
      })}
    >
      <T variant="mono" style={{ width: 22, textAlign: "right" }}>
        {quantity}
      </T>
      <CardThumb uri={card.imageUrl} width={30} name={card.name} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{card.name}</T>
        {note && (
          <T variant="small" numberOfLines={1} style={{ color: colors.inuse }}>
            {note}
          </T>
        )}
      </View>
      {right ? <T variant="mono">{right}</T> : <ManaCost cost={card.manaCost} size={13} />}
      {dot && (
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[dot] }}
        />
      )}
    </Pressable>
  );
}

function SwapRow({
  swap,
  actions,
}: {
  swap: SwapDTO;
  actions?: { apply: () => void; discard: () => void; disabled: boolean } | undefined;
}) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: colors.panel,
        borderRadius: radius.md,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => router.push(`/card/${swap.out.card.oracleId}`)}
          style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center" }}
        >
          <CardThumb uri={swap.out.card.imageUrl} width={40} />
          <View style={{ flex: 1 }}>
            <T variant="small" style={{ color: colors.out }}>
              Quita
            </T>
            <T numberOfLines={2}>{swap.out.card.name}</T>
          </View>
        </Pressable>
        <Ionicons name="arrow-forward" size={18} color={colors.text3} />
        <Pressable
          onPress={() => router.push(`/card/${swap.in.card.oracleId}`)}
          style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center" }}
        >
          <CardThumb uri={swap.in.card.imageUrl} width={40} />
          <View style={{ flex: 1 }}>
            <T variant="small" style={{ color: colors.in }}>
              Mete
            </T>
            <T numberOfLines={2}>{swap.in.card.name}</T>
          </View>
        </Pressable>
      </View>
      <T variant="small">{swap.reason}</T>
      {actions && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Descartar"
            kind="ghost"
            onPress={actions.discard}
            disabled={actions.disabled}
            style={{ flex: 1, minHeight: 40 }}
          />
          <Button
            label="Aplicar"
            icon="checkmark"
            onPress={actions.apply}
            disabled={actions.disabled}
            style={{ flex: 1, minHeight: 40 }}
          />
        </View>
      )}
    </View>
  );
}

function Stats({ analysis: a }: { analysis: Analysis }) {
  const curve = Object.entries(a.curve)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((x, y) => x[0] - y[0]);
  const max = Math.max(1, ...curve.map(([, v]) => v));
  return (
    <View style={{ paddingHorizontal: 16, gap: 16 }}>
      <T variant="label">Curva de maná</T>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 120 }}>
        {curve.map(([cmc, n]) => (
          <View key={cmc} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <T variant="small">{n}</T>
            <View
              style={{
                width: "100%",
                height: (n / max) * 80,
                backgroundColor: colors.accent,
                borderRadius: 3,
              }}
            />
            <T variant="small">{cmc >= 7 ? "7+" : cmc}</T>
          </View>
        ))}
      </View>
      <T variant="label">Roles (mínimos recomendados)</T>
      {a.roles.map((r) => {
        const ok = r.count >= r.min;
        return (
          <View key={r.role} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row" }}>
              <T style={{ flex: 1 }}>{r.label}</T>
              <T variant="mono" style={{ color: ok ? colors.text2 : colors.warn }}>
                {r.count}
                {r.min > 0 ? ` / ${r.min}` : ""}
              </T>
            </View>
            {r.min > 0 && (
              <View style={{ height: 6, backgroundColor: colors.raised, borderRadius: 3 }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, (r.count / r.min) * 100)}%`,
                    backgroundColor: ok ? colors.in : colors.warn,
                    borderRadius: 3,
                  }}
                />
              </View>
            )}
          </View>
        );
      })}
      <T variant="label">Bracket {a.bracket.bracket}</T>
      {a.bracket.reasons.map((r, i) => (
        <T key={i} variant="small">
          · {r}
        </T>
      ))}
    </View>
  );
}
