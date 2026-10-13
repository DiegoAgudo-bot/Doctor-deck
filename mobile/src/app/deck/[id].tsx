import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SectionList, Share, View } from "react-native";
import type {
  AnalyzeResponse,
  CardDTO,
  DeckCardDTO,
  DeckViewDTO,
  OwnershipItemDTO,
  SwapDTO,
} from "@/server/dto";
import { CardThumb, ColorPips, ManaCost } from "~/components/card-bits";
import { Banner, Button, ErrorView, IconButton, Loading, Segmented, T } from "~/components/ui";
import { api, artUri } from "~/lib/api";
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
        error={analysis.error}
        retry={() => analysis.refetch()}
        needsCommander={analysis.data?.status === "needs_commander"}
      />
    </>
  );
}

function DeckBody({
  deck,
  analysis: a,
  tab,
  setTab,
  loading,
  error,
  retry,
  needsCommander,
}: {
  deck: DeckViewDTO;
  analysis: Analysis | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  needsCommander: boolean;
}) {
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
            { key: "missing", label: "Me falta" },
            { key: "changes", label: "Cambios" },
            { key: "stats", label: "Datos" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {a?.edhrec.warning && <Banner text={a.edhrec.warning} />}
        {needsCommander && <Banner text="Este mazo no tiene comandante: elígelo en la web." />}
        {tab === "missing" && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T style={{ flex: 1 }}>
              Comprar lo que falta:{" "}
              <T style={{ fontWeight: "700" }}>{euros(a.ownership.totals.cost)}</T>
            </T>
            <Button
              label="Compartir lista"
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
                Con tu colección no hay cambios que lo mejoren ahora mismo.
              </T>
            )}
          </>
        }
        renderSectionHeader={() => null}
        renderItem={({ item }) => <SwapRow swap={item} />}
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
}: {
  card: CardDTO;
  quantity: number;
  dot?: OwnershipItemDTO["status"] | undefined;
  right?: string | undefined;
  note?: string | undefined;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/card/${card.oracleId}`)}
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

function SwapRow({ swap }: { swap: SwapDTO }) {
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
