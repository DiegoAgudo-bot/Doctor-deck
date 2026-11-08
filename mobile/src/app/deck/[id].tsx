import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Share, View } from "react-native";
import type {
  AnalyzeResponse,
  CardDTO,
  DeckCardDTO,
  DeckCombosDTO,
  DeckViewDTO,
  OwnershipItemDTO,
  SwapDTO,
} from "@/server/dto";
import { CardThumb, ColorPips, ManaCost } from "~/components/card-bits";
import {
  AlternativesPanel,
  BuyPanel,
  CombosPanel,
  OpeningHandPanel,
} from "~/components/deck-analysis";
import { AddCardsSheet, CardActionsSheet, OtherDecksSheet } from "~/components/deck-editor";
import {
  DeckSettingsSheet,
  ExportSheet,
  ThemePicker,
  useDeckManage,
} from "~/components/deck-manage";
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
import { ROLE_LABELS, ROLES } from "@/domain/roles/types";
import { alert } from "~/components/dialog";
import { roleName, t } from "~/lib/i18n";

type Tab = "list" | "missing" | "changes" | "combos" | "stats";
type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;

const TYPE_ORDER: [string, string][] = [
  ["Creature", t("Criaturas", "Creatures")],
  ["Planeswalker", "Planeswalkers"],
  ["Battle", t("Batallas", "Battles")],
  ["Instant", t("Instantáneos", "Instants")],
  ["Sorcery", t("Conjuros", "Sorceries")],
  ["Artifact", t("Artefactos", "Artifacts")],
  ["Enchantment", t("Encantamientos", "Enchantments")],
  ["Land", t("Tierras", "Lands")],
];
const typeGroup = (typeLine: string) => {
  const front = typeLine.split("//")[0] ?? typeLine;
  return TYPE_ORDER.find(([k]) => front.includes(k))?.[1] ?? t("Otras", "Other");
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
  const [tab, setTab] = useState<Tab>(
    initialTab === "missing" || initialTab === "combos" ? initialTab : "list",
  );
  /** Comandantes elegidos aquí (si la lista no lo dice); en un mazo mío se guardan. */
  const [chosen, setChosen] = useState<string[] | null>(null);
  /** En el mazo de otro, el tema se elige solo para verlo (no se guarda). */
  const [themeHere, setThemeHere] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<"settings" | "export" | null>(null);
  const deck = useQuery({
    queryKey: ["deck", id],
    queryFn: () => api<DeckViewDTO>(`/api/decks/${id}`),
  });
  const d = deck.data;
  const theme = d ? (d.isMine || themeHere === undefined ? d.theme : themeHere) : null;
  const analysis = useQuery({
    queryKey: ["analysis", id, d?.updatedAt, chosen, theme],
    enabled: Boolean(d),
    staleTime: 5 * 60_000,
    // Al aplicar un cambio se vuelve a analizar: mientras, se sigue viendo lo de antes.
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<AnalyzeResponse>("/api/analyze", {
        body: {
          input: d!.input,
          commanders: chosen ?? d!.commanders,
          locked: d!.locked,
          excluded: d!.excluded,
          ...(theme ? { theme } : {}),
          ...(d!.isMine ? { deckId: d!.id } : {}),
          ...(d!.targetBracket ? { targetBracket: d!.targetBracket } : {}),
        },
      }),
  });

  // Los combos van aparte (tardan más): al llegar, el bracket cuenta también con ellos.
  const ok = analysis.data?.status === "ok";
  const combos = useQuery({
    queryKey: ["combos", id, d?.updatedAt, chosen],
    enabled: ok,
    staleTime: 10 * 60_000,
    queryFn: () =>
      api<DeckCombosDTO>("/api/combos", {
        body: {
          input: d!.input,
          commanders: chosen ?? d!.commanders,
          ...(d!.isMine ? { deckId: d!.id } : {}),
        },
      }),
  });
  const actions = useDeckActions(d);
  const manage = useDeckManage(d);
  // Los temas solo vienen en la página general del comandante: se recuerdan al elegir uno.
  const [themes, setThemes] = useState<ThemeList>([]);
  const found = analysis.data?.status === "ok" ? analysis.data.edhrec.themes : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se guarda lo que llega
    if (found && found.length > 0) setThemes(found);
  }, [found]);

  if (deck.isPending) return <Loading />;
  if (deck.isError || !d) return <ErrorView error={deck.error} onRetry={() => deck.refetch()} />;
  const a = analysis.data?.status === "ok" ? analysis.data : null;

  return (
    <>
      <Stack.Screen
        options={{
          // El nombre ya va grande en la portada del mazo: la cabecera solo lleva las acciones.
          title: "",
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              {!d.isMine && (
                <IconButton
                  icon={d.liked ? "heart" : "heart-outline"}
                  color={d.liked ? colors.out : colors.text}
                  label={
                    d.liked
                      ? t(`Quitar me gusta (${d.likes})`, `Unlike (${d.likes})`)
                      : t(`Me gusta (${d.likes})`, `Like (${d.likes})`)
                  }
                  onPress={() => actions.like.mutate(!d.liked)}
                />
              )}
              {!d.isMine && (
                <IconButton
                  icon="copy-outline"
                  label={t("Guardar una copia", "Save a copy")}
                  onPress={() => !actions.copy.isPending && actions.copy.mutate()}
                />
              )}
              <IconButton
                icon="share-social-outline"
                label={t("Compartir", "Share")}
                onPress={() =>
                  Share.share({ message: `${d.name} · https://doctordeck.app/decks/${d.id}` })
                }
              />
              {d.visibility !== "private" && (
                <IconButton
                  icon="chatbubble-outline"
                  label={t("Comentarios", "Comments")}
                  onPress={() => router.push(`/deck-comments/${d.id}`)}
                />
              )}
              <IconButton
                icon="download-outline"
                label={t("Exportar", "Export")}
                onPress={() => setSheet("export")}
              />
              {d.isMine && (
                <IconButton
                  icon="settings-outline"
                  label={t("Ajustes del mazo", "Deck settings")}
                  onPress={() => setSheet("settings")}
                />
              )}
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
        refreshing={analysis.isPlaceholderData || analysis.isFetching || deck.isFetching}
        error={analysis.error}
        retry={() => analysis.refetch()}
        candidates={analysis.data?.status === "needs_commander" ? analysis.data.candidates : null}
        onChooseCommanders={(ids) => {
          setChosen(ids);
          if (d.isMine) actions.saveCommanders.mutate(ids);
        }}
        actions={actions}
        combos={combos.data}
        combosLoading={combos.isPending || combos.isFetching}
        combosError={combos.error}
        themes={themes}
        theme={theme}
        onTheme={(t) => (d.isMine ? manage.save.mutate({ theme: t }) : setThemeHere(t))}
        onToggleLock={(oracleId) =>
          manage.save.mutate({
            locked: d.locked.includes(oracleId)
              ? d.locked.filter((x) => x !== oracleId)
              : [...d.locked, oracleId],
          })
        }
        saving={manage.save.isPending}
      />
      <ExportSheet
        name={d.name}
        analysis={a}
        open={sheet === "export"}
        onClose={() => setSheet(null)}
      />
      {d.isMine && (
        <DeckSettingsSheet
          deckId={d.id}
          open={sheet === "settings"}
          onClose={() => setSheet(null)}
          onDeleted={() => router.back()}
        />
      )}
    </>
  );
}

type ThemeList = Analysis["edhrec"]["themes"];

/** Una fila de la Lista o de «Me falta». */
interface ListRow {
  card: CardDTO;
  quantity: number;
  /** En la Lista: la carta del mazo (para editarla); null en los comandantes. */
  deckCard?: DeckCardDTO | null;
  price?: number | null;
  note?: string;
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
          ? t(
              `Hecho: sale ${swaps[0]!.out.card.name}, entra ${swaps[0]!.in.card.name}`,
              `Done: ${swaps[0]!.out.card.name} out, ${swaps[0]!.in.card.name} in`,
            )
          : t(`${swaps.length} cambios aplicados`, `${swaps.length} changes applied`),
      );
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const discard = useMutation({
    // El servidor lo añade a los descartes de la versión guardada (no reenvía la lista de aquí,
    // que puede ser vieja si se acaba de aplicar otro cambio).
    mutationFn: (swap: SwapDTO) =>
      api(`/api/decks/${d!.id}`, { method: "PATCH", body: { exclude: swap.in.card.oracleId } }),
    onSuccess: (_r, swap) => {
      toast(
        t(
          `No se volverá a proponer ${swap.in.card.name}`,
          `${swap.in.card.name} won't be suggested again`,
        ),
      );
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: (card: CardDTO) => changeCards([{ oracleId: card.oracleId, delta: -1 }]),
    onSuccess: (_r, card) => {
      tapFeedback();
      toast(t(`Quitada ${card.name}`, `Removed ${card.name}`));
      reload();
    },
    onError: (e) => toast(e.message),
  });
  const wishlist = useMutation({
    mutationFn: (inWishlist: boolean) =>
      api(`/api/decks/${d!.id}`, { method: "PATCH", body: { inWishlist } }),
    onSuccess: (_r, on) => {
      toast(
        on
          ? t("Lo que falta va a tu lista de deseos", "What's missing goes to your wishlist")
          : t("Fuera de tu lista de deseos", "Off your wishlist"),
      );
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
      toast(t("Copia guardada en tus mazos (privada)", "Copy saved to your decks (private)"));
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.replace(`/deck/${r.id}`);
    },
    onError: (e) => toast(e.message),
  });
  const like = useMutation({
    mutationFn: (on: boolean) =>
      api<{ likes: number; liked: boolean }>(`/api/decks/${d!.id}/like`, {
        method: on ? "POST" : "DELETE",
      }),
    onSuccess: (r) => {
      tapFeedback();
      qc.setQueryData<DeckViewDTO>(["deck", d?.id], (old) =>
        old ? { ...old, likes: r.likes, liked: r.liked } : old,
      );
    },
    onError: (e) => toast(e.message),
  });
  const saveCommanders = useMutation({
    mutationFn: (commanders: string[]) =>
      api("/api/decks", {
        body: {
          id: d!.id,
          name: d!.name,
          input: d!.input,
          commanders,
          locked: d!.locked,
          excluded: d!.excluded,
          ...(d!.theme ? { theme: d!.theme } : {}),
        },
      }),
    onSuccess: () => {
      toast(t("Comandante guardado", "Commander saved"));
      reload();
    },
    onError: (e) => toast(e.message),
  });
  return { apply, discard, remove, wishlist, copy, like, saveCommanders };
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
  candidates,
  onChooseCommanders,
  actions,
  combos,
  combosLoading,
  combosError,
  themes,
  theme,
  onTheme,
  onToggleLock,
  saving,
}: {
  deck: DeckViewDTO;
  analysis: Analysis | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  retry: () => void;
  candidates: CardDTO[] | null;
  onChooseCommanders: (ids: string[]) => void;
  actions: DeckActions;
  combos: DeckCombosDTO | undefined;
  combosLoading: boolean;
  combosError: Error | null;
  themes: ThemeList;
  theme: string | null;
  onTheme: (slug: string | null) => void;
  onToggleLock: (oracleId: string) => void;
  saving: boolean;
}) {
  const mine = deck.isMine;
  const [groupBy, setGroupBy] = useState<"type" | "role">("type");
  const [editing, setEditing] = useState<DeckCardDTO | null>(null);
  const [panel, setPanel] = useState<"add" | "others" | null>(null);
  const busy =
    actions.apply.isPending || actions.discard.isPending || actions.remove.isPending || saving;
  // Hasta que llega el análisis nuevo, los cambios que se ven pueden estar ya aplicados.
  const waiting = busy || refreshing;
  const ownership = useMemo(
    () => new Map((a?.ownership.items ?? []).map((i) => [i.card.oracleId, i])),
    [a],
  );
  const sections = useMemo((): { title: string; data: ListRow[] }[] => {
    if (!a) return [];
    if (tab === "list") {
      const groups = new Map<string, DeckCardDTO[]>();
      const roleStat = new Map(a.roles.map((r) => [r.role, r]));
      const roleTitle = (role: (typeof ROLES)[number]) => {
        const s = roleStat.get(role);
        const label = roleName(role);
        return `${label.charAt(0).toUpperCase()}${label.slice(1)}${s && s.min > 0 ? ` · ${t("mínimo", "minimum")} ${s.min}` : ""}`;
      };
      for (const c of a.cards) {
        const g = groupBy === "role" ? roleTitle(c.primaryRole) : typeGroup(c.card.typeLine);
        groups.set(g, [...(groups.get(g) ?? []), c]);
      }
      const order =
        groupBy === "role"
          ? ROLES.map(roleTitle)
          : [t("Comandante", "Commander"), ...TYPE_ORDER.map(([, l]) => l), t("Otras", "Other")];
      const commanderRows = a.commanders.map((card) => ({
        card,
        quantity: 1,
        deckCard: null as DeckCardDTO | null,
      }));
      return [
        {
          title:
            a.commanders.length > 1 ? t("Comandantes", "Commanders") : t("Comandante", "Commander"),
          data: commanderRows,
        },
        ...order
          .filter((g) => groups.has(g))
          .map((g) => {
            const rows = (groups.get(g) ?? []).sort(
              (x, y) => x.card.cmc - y.card.cmc || x.card.name.localeCompare(y.card.name),
            );
            return {
              title: `${g} (${rows.reduce((s, r) => s + r.quantity, 0)})`,
              data: rows.map((r) => ({ card: r.card, quantity: r.quantity, deckCard: r })),
            };
          }),
      ];
    }
    if (tab === "missing") {
      const toBuy = a.ownership.items.filter((i) => i.toBuy > 0);
      const other = a.ownership.items.filter((i) => i.fromOtherDecks > 0 && i.toBuy === 0);
      return [
        {
          title: `${t("Te faltan", "Missing")} (${toBuy.reduce((s, i) => s + i.toBuy, 0)})`,
          data: toBuy.map((i) => ({ card: i.card, quantity: i.toBuy, price: i.price })),
        },
        ...(other.length > 0
          ? [
              {
                title: `${t("En otros mazos", "In other decks")} (${other.length})`,
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
  }, [a, tab, groupBy]);

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Cover
        deck={deck}
        analysis={a}
        bracket={combos?.bracket.bracket ?? a?.bracket.bracket ?? null}
        onOtherDecks={() => setPanel("others")}
      />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Segmented<Tab>
          options={[
            { key: "list", label: t("Lista", "List") },
            {
              key: "missing",
              label:
                a && a.ownership.totals.toBuy > 0
                  ? `${t("Falta", "Missing")} ${a.ownership.totals.toBuy}`
                  : t("Falta", "Missing"),
            },
            {
              key: "changes",
              label:
                a && a.swaps.length > 0
                  ? `${t("Cambios", "Changes")} ${a.swaps.length}`
                  : t("Cambios", "Changes"),
            },
            {
              key: "combos",
              label:
                combos && combos.included.length > 0
                  ? `Combos ${combos.included.length}`
                  : "Combos",
            },
            { key: "stats", label: t("Datos", "Stats") },
          ]}
          value={tab}
          onChange={setTab}
        />
        <ThemePicker themes={themes} value={theme} onChange={onTheme} disabled={waiting} />
        {(refreshing || busy) && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <T variant="small">
              {busy ? t("Guardando…", "Saving…") : t("Recalculando…", "Recalculating…")}
            </T>
          </View>
        )}
        {tab === "list" && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Segmented<"type" | "role">
                options={[
                  { key: "type", label: t("Por tipo", "By type") },
                  { key: "role", label: t("Por rol", "By role") },
                ]}
                value={groupBy}
                onChange={setGroupBy}
              />
            </View>
            {mine && (
              <Button
                label={t("Añadir", "Add")}
                icon="add"
                kind="secondary"
                onPress={() => setPanel("add")}
              />
            )}
          </View>
        )}
        {tab === "list" && mine && a && (
          <T variant="small">
            {t(
              "Toca una carta para cambiar sus copias, su edición o sus roles. El candado hace que nunca se proponga sacarla.",
              "Tap a card to change its copies, printing or roles. The lock means it's never suggested to cut.",
            )}
          </T>
        )}
        {tab === "changes" && mine && a && a.swaps.length > 1 && (
          <Button
            label={t(
              `Aplicar los ${a.swaps.length} cambios`,
              `Apply the ${a.swaps.length} changes`,
            )}
            icon="checkmark-done"
            disabled={waiting}
            onPress={() =>
              alert(
                t(
                  `¿Aplicar los ${a.swaps.length} cambios?`,
                  `Apply the ${a.swaps.length} changes?`,
                ),
                t(
                  "Se guardan en el mazo. Puedes deshacerlos editando la lista.",
                  "They're saved to the deck. You can undo them by editing the list.",
                ),
                [
                  { text: t("Cancelar", "Cancel"), style: "cancel" },
                  { text: t("Aplicar", "Apply"), onPress: () => actions.apply.mutate(a.swaps) },
                ],
              )
            }
          />
        )}
        {a?.edhrec.warning && <Banner text={a.edhrec.warning} />}
        {candidates && <CommanderPicker candidates={candidates} onChoose={onChooseCommanders} />}
        {tab === "missing" && a && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T style={{ flex: 1 }}>
              {t("Comprar lo que falta:", "Buy what's missing:")}{" "}
              <T style={{ fontWeight: "700" }}>{euros(a.ownership.totals.cost)}</T>
            </T>
            {mine && (
              <Chip
                label={t("En deseos", "On wishlist")}
                icon={deck.inWishlist ? "heart" : "heart-outline"}
                active={deck.inWishlist}
                accessibilityLabel={
                  deck.inWishlist
                    ? t(
                        "Quitar lo que falta de tu lista de deseos",
                        "Remove what's missing from your wishlist",
                      )
                    : t(
                        "Añadir lo que falta a tu lista de deseos",
                        "Add what's missing to your wishlist",
                      )
                }
                onPress={() => actions.wishlist.mutate(!deck.inWishlist)}
              />
            )}
            <Button
              label={t("Compartir", "Share")}
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
        <Loading label={t("Analizando el mazo…", "Analyzing the deck…")} />
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

  // Añadir cartas, acciones de una carta y «en otros mazos»: valen en todas las pestañas.
  const sheets = a && (
    <>
      {mine && (
        <AddCardsSheet
          deck={deck}
          analysis={a}
          open={panel === "add"}
          onClose={() => setPanel(null)}
        />
      )}
      {mine && (
        <CardActionsSheet
          deck={deck}
          analysis={a}
          card={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <OtherDecksSheet
        items={a.ownership.items}
        open={panel === "others"}
        onClose={() => setPanel(null)}
      />
    </>
  );

  if (tab === "changes" || tab === "stats" || tab === "combos") {
    return (
      <>
        <SectionList
          sections={[{ title: "", data: tab === "changes" ? (a?.swaps ?? []) : [] }]}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={
            <>
              {header}
              {tab === "stats" && a && (
                <Stats analysis={a} bracket={combos?.bracket ?? a.bracket} />
              )}
              {tab === "combos" && (
                <CombosPanel data={combos} loading={combosLoading} error={combosError} />
              )}
              {tab === "changes" && a && a.swaps.length === 0 && (
                <T variant="muted" style={{ paddingHorizontal: 16 }}>
                  {t(
                    "Con tu colección no hay cambios que lo mejoren ahora mismo. Añade cartas a tu colección o mira «Falta» para ver qué comprar.",
                    "No changes from your collection improve it right now. Add cards to your collection or check “Missing” to see what to buy.",
                  )}
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
        {sheets}
      </>
    );
  }

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(row, i) => `${row.card.oracleId}-${i}`}
        ListHeaderComponent={header}
        ListFooterComponent={
          tab === "missing" && a ? (
            <View style={{ gap: 12, padding: 16 }}>
              <AlternativesPanel alternatives={a.ownership.alternatives} />
              <BuyPanel deck={deck} analysis={a} />
            </View>
          ) : null
        }
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
            right={item.price != null ? euros(item.price) : undefined}
            note={item.note}
            onPress={
              mine && tab === "list" && item.deckCard
                ? () => setEditing(item.deckCard ?? null)
                : undefined
            }
            lock={
              mine &&
              tab === "list" &&
              !a?.commanders.some((c) => c.oracleId === item.card.oracleId)
                ? {
                    on: deck.locked.includes(item.card.oracleId),
                    toggle: () => onToggleLock(item.card.oracleId),
                    disabled: waiting,
                  }
                : undefined
            }
            onLongPress={
              mine &&
              tab === "list" &&
              !a?.commanders.some((c) => c.oracleId === item.card.oracleId)
                ? () =>
                    alert(
                      t(`¿Quitar ${item.card.name}?`, `Remove ${item.card.name}?`),
                      t("Se quita una copia del mazo.", "One copy is removed from the deck."),
                      [
                        { text: t("Cancelar", "Cancel"), style: "cancel" },
                        {
                          text: t("Quitar", "Remove"),
                          style: "destructive",
                          onPress: () => actions.remove.mutate(item.card),
                        },
                      ],
                    )
                : undefined
            }
          />
        )}
      />
      {sheets}
    </>
  );
}

/** La lista no dice cuál es el comandante: elegir uno (o dos, si son pareja) de los candidatos. */
function CommanderPicker({
  candidates,
  onChoose,
}: {
  candidates: CardDTO[];
  onChoose: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  return (
    <View style={{ gap: 8 }}>
      <Banner
        text={t(
          "Esta lista no dice cuál es el comandante. Elígelo (dos si son pareja).",
          "This list doesn't say who the commander is. Choose it (two if they're partners).",
        )}
      />
      {candidates.map((c) => (
        <Pressable
          key={c.oracleId}
          onPress={() => toggle(c.oracleId)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 8,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: picked.includes(c.oracleId) ? colors.accent : colors.line,
            backgroundColor: pressed ? colors.hover : colors.panel,
          })}
        >
          <CardThumb uri={c.imageUrl} width={40} name={c.name} />
          <T style={{ flex: 1 }} numberOfLines={1}>
            {c.name}
          </T>
          <Ionicons
            name={picked.includes(c.oracleId) ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={picked.includes(c.oracleId) ? colors.accent : colors.text3}
          />
        </Pressable>
      ))}
      <Button
        label={
          picked.length > 1
            ? t("Usar estos comandantes", "Use these commanders")
            : t("Usar este comandante", "Use this commander")
        }
        disabled={picked.length === 0}
        onPress={() => onChoose(picked)}
      />
    </View>
  );
}

function Cover({
  deck,
  analysis: a,
  bracket,
  onOtherDecks,
}: {
  deck: DeckViewDTO;
  analysis: Analysis | null;
  /** Con los combos si ya han llegado. */
  bracket: number | null;
  onOtherDecks: () => void;
}) {
  const commander = a?.commanders[0];
  const art = artUri(commander?.imageUrl);
  const tot = a?.ownership.totals;
  const pct = tot && tot.cards > 0 ? Math.round((tot.have / tot.cards) * 100) : null;
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
          <Pill text={`${a?.totalCards ?? deck.cardCount} ${t("cartas", "cards")}`} />
          {bracket !== null && <Pill text={`Bracket ${bracket}`} />}
          {pct !== null && (
            <Pill text={t(`Tienes ${pct} %`, `You own ${pct}%`)} color={colors.owned} />
          )}
          {tot && tot.toBuy > 0 && (
            <Pill
              text={t(
                `Faltan ${tot.toBuy} · ${euros(tot.cost)}`,
                `Missing ${tot.toBuy} · ${euros(tot.cost)}`,
              )}
              color={colors.warn}
            />
          )}
          {tot && tot.fromOtherDecks > 0 && (
            <Pressable
              onPress={onOtherDecks}
              accessibilityRole="button"
              accessibilityLabel={t(
                `${tot.fromOtherDecks} en otros mazos: ver cuáles`,
                `${tot.fromOtherDecks} in other decks: see which`,
              )}
            >
              <Pill
                text={t(
                  `${tot.fromOtherDecks} en otros mazos ›`,
                  `${tot.fromOtherDecks} in other decks ›`,
                )}
                color={colors.inuse}
              />
            </Pressable>
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
  lock,
  onPress,
  onLongPress,
}: {
  card: CardDTO;
  quantity: number;
  dot?: OwnershipItemDTO["status"] | undefined;
  right?: string | undefined;
  note?: string | undefined;
  /** Candado (en mis mazos): bloqueada = nunca se propone sacarla. */
  lock?: { on: boolean; toggle: () => void; disabled: boolean } | undefined;
  /** Si no se da, abre la ficha de la carta. */
  onPress?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/card/${card.oracleId}`))}
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
      {lock && (
        <Pressable
          onPress={lock.toggle}
          disabled={lock.disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: lock.on }}
          accessibilityLabel={
            lock.on
              ? t(`Desbloquear ${card.name}`, `Unlock ${card.name}`)
              : t(
                  `Bloquear ${card.name} (no se propondrá sacarla)`,
                  `Lock ${card.name} (it won't be suggested to cut)`,
                )
          }
        >
          <Ionicons
            name={lock.on ? "lock-closed" : "lock-open-outline"}
            size={16}
            color={lock.on ? colors.accent : colors.text3}
          />
        </Pressable>
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
              {t("Quita", "Out")}
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
              {t("Mete", "In")}
            </T>
            <T numberOfLines={2}>{swap.in.card.name}</T>
          </View>
        </Pressable>
      </View>
      <T variant="small">{swap.reason}</T>
      {actions && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={t("Descartar", "Dismiss")}
            kind="ghost"
            onPress={actions.discard}
            disabled={actions.disabled}
            style={{ flex: 1, minHeight: 40 }}
          />
          <Button
            label={t("Aplicar", "Apply")}
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

function Stats({ analysis: a, bracket }: { analysis: Analysis; bracket: Analysis["bracket"] }) {
  const curve = Object.entries(a.curve)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((x, y) => x[0] - y[0]);
  const max = Math.max(1, ...curve.map(([, v]) => v));
  return (
    <View style={{ paddingHorizontal: 16, gap: 16 }}>
      <T variant="label">{t("Curva de maná", "Mana curve")}</T>
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
      <T variant="label">{t("Roles (mínimos recomendados)", "Roles (recommended minimums)")}</T>
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
      <T variant="label">Bracket {bracket.bracket}</T>
      {bracket.reasons.map((r, i) => (
        <T key={i} variant="small">
          · {r}
        </T>
      ))}
      {!bracket.combosChecked && (
        <T variant="small">
          {t("Buscando combos para afinarlo…", "Looking for combos to refine it…")}
        </T>
      )}
      <OpeningHandPanel cards={a.cards} />
    </View>
  );
}
