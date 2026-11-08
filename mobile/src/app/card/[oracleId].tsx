import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import type { CardDetailDTO } from "@/server/card-dto";
import type { CollectionLineDTO, PrintingDTO } from "@/server/dto";
import { AddToDeckSheet } from "~/components/add-to-deck";
import { CardThumb, FoilMark, ManaCost } from "~/components/card-bits";
import { LendSheet } from "~/components/lend";
import { CardPriceHistory } from "~/components/price-chart";
import { Sheet } from "~/components/sheet";
import { CommanderStaples } from "~/components/staples";
import { Stepper } from "~/components/stepper";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, ErrorView, Loading, T } from "~/components/ui";
import { useAddCopies, useCopyDefaults } from "~/lib/add-copies";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { CONDITION_OPTIONS, conditionShort, LANGUAGE_OPTIONS } from "~/lib/copies";
import { euros } from "~/lib/format";
import { colors, radius } from "~/lib/theme";
import { alert } from "~/components/dialog";
import { t } from "~/lib/i18n";

/**
 * Ficha de una carta, como en ManaBox: imagen, precio, mis copias con «Añadir 1» (con la edición,
 * idioma y estado de la última vez) y luego añadir a un mazo, lista de deseos y el texto; si
 * puede ser comandante, lo que juega la comunidad con ella.
 */
export default function CardScreen() {
  const { oracleId } = useLocalSearchParams<{ oracleId: string }>();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["card", oracleId],
    queryFn: () => api<CardDetailDTO>(`/api/cards/${oracleId}`),
  });
  const lines = useQuery({
    queryKey: ["lines", oracleId],
    queryFn: () =>
      api<CollectionLineDTO[]>(`/api/collection/lines?oracleId=${encodeURIComponent(oracleId)}`),
  });
  const [sheet, setSheet] = useState<"add" | "deck" | "lend" | null>(null);
  // La edición que se ve y que añade «Añadir 1»: la elegida en «Opciones» o la de mi copia.
  const [shown, setShown] = useState<PrintingDTO | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [defaults, setDefaults] = useCopyDefaults();
  const addCopies = useAddCopies();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lines", oracleId] });
    qc.invalidateQueries({ queryKey: ["card", oracleId] });
    qc.invalidateQueries({ queryKey: ["collection"] });
  };

  const wish = useMutation({
    mutationFn: (quantity: number) =>
      api(`/api/trades/wishes/${oracleId}`, { method: "PUT", body: { quantity } }),
    onSuccess: (_r, quantity) => {
      tapFeedback();
      toast(quantity > 0 ? "En tu lista de deseos" : "Quitada de tu lista de deseos");
      refresh();
    },
    onError: (e) => toast(e.message),
  });

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorView error={detail.error} onRetry={() => detail.refetch()} />;
  const d = detail.data;
  const myLines = lines.data ?? [];
  const myPrinting = myLines[0]?.printing?.scryfallId;
  const quickPrinting =
    shown ??
    d.printings.find((p) => p.scryfallId === myPrinting) ??
    d.printings.find((p) => p.imageUrl) ??
    null;
  const image = shown?.imageUrl ?? myLines[0]?.card.imageUrl ?? d.card.imageUrl;
  const imgWidth = Math.min(width - 96, 300);
  const quickAdd = () =>
    addCopies.mutate({
      oracleId,
      scryfallId: quickPrinting?.scryfallId,
      printingLabel: quickPrinting
        ? `${quickPrinting.setCode.toUpperCase()} #${quickPrinting.collectorNumber}`
        : undefined,
      quantity: 1,
      foil: false,
      ...defaults,
    });

  return (
    <>
      <Stack.Screen options={{ title: d.card.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View style={{ alignItems: "center" }}>
          <CardThumb uri={image} width={imgWidth} name={d.card.name} large />
        </View>

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T variant="title" style={{ flex: 1 }}>
              {d.card.name}
            </T>
            <ManaCost cost={d.card.manaCost} size={18} />
          </View>
          <T variant="small">{d.card.typeLine}</T>
          {!d.legalCommander && (
            <Banner text={t("No es legal en Commander", "Not legal in Commander")} />
          )}
        </View>

        {/* Precio, como en la cabecera de la carta en ManaBox. */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PriceBox label={t("Desde", "From")} value={euros(d.minPrice)} />
          <PriceBox label={t("Foil desde", "Foil from")} value={euros(d.minFoilPrice)} />
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(d.card.name)}`,
              )
            }
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? colors.hover : colors.panel,
              borderRadius: radius.md,
              padding: 10,
              justifyContent: "center",
              alignItems: "center",
            })}
          >
            <Ionicons name="cart-outline" size={20} color={colors.accent} />
            <T variant="small" style={{ color: colors.accent }}>
              {t("Comprar", "Buy")}
            </T>
          </Pressable>
        </View>

        {/* En mi colección: copias editables y añadir. */}
        <View style={{ gap: 8 }}>
          <T variant="label">
            {t("En tu colección", "In your collection")}
            {d.mine && d.mine.owned > 0
              ? ` · ${d.mine.owned} (${d.mine.free} ${t("libres", "spare")})`
              : ""}
          </T>
          {d.mine && d.mine.usedIn.length > 0 && (
            <T variant="small" style={{ color: colors.inuse }}>
              {t("En", "In")}: {d.mine.usedIn.join(", ")}
            </T>
          )}
          {lines.isPending ? (
            <Loading />
          ) : (
            myLines.map((l) => <LineRow key={l.id} line={l} onChanged={refresh} />)
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label={myLines.length > 0 ? t("Añadir 1 más", "Add 1 more") : t("Añadir 1", "Add 1")}
              icon="add"
              onPress={quickAdd}
              busy={addCopies.isPending}
              style={{ flex: 1 }}
            />
            <Button
              label={t("Edición, foil…", "Printing, foil…")}
              icon="options-outline"
              kind="secondary"
              onPress={() => setSheet("add")}
              style={{ flex: 1 }}
            />
          </View>
          {quickPrinting && (
            <T variant="small">
              {t("«Añadir» usa", "“Add” uses")} {quickPrinting.setCode.toUpperCase()} #
              {quickPrinting.collectorNumber}
              {defaults.language !== "en" ? ` · ${defaults.language.toUpperCase()}` : ""} ·{" "}
              {conditionShort(defaults.condition)}
            </T>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Button
            label={t("Añadir a un mazo", "Add to a deck")}
            icon="layers-outline"
            kind="secondary"
            onPress={() => setSheet("deck")}
          />
          <Button
            label={
              d.mine?.wished
                ? t("En tu lista de deseos", "On your wishlist")
                : t("Añadir a la lista de deseos", "Add to wishlist")
            }
            icon={d.mine?.wished ? "heart" : "heart-outline"}
            kind="secondary"
            busy={wish.isPending}
            onPress={() => wish.mutate(d.mine?.wished ? 0 : 1)}
          />
          {d.mine && d.mine.free > 0 && (
            <Button
              label={t("Prestar", "Lend")}
              icon="hand-left-outline"
              kind="secondary"
              onPress={() => setSheet("lend")}
            />
          )}
          {d.commander && (
            <Button
              label={t(
                "Crear un mazo con ella de comandante",
                "Create a deck with it as commander",
              )}
              icon="add-circle-outline"
              kind="ghost"
              onPress={() => router.push(`/deck-new?commander=${oracleId}`)}
            />
          )}
        </View>

        {(d.oracleText || d.roles.length > 0) && (
          <View style={{ gap: 8 }}>
            {d.oracleText && (
              <View style={{ backgroundColor: colors.panel, borderRadius: radius.md, padding: 12 }}>
                <T style={{ lineHeight: 21 }}>{d.oracleText}</T>
              </View>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {d.roles.map((r) => (
                <View
                  key={r.role}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: r.primary ? colors.accent : colors.raised,
                  }}
                >
                  <T variant="small" style={r.primary ? { color: colors.onAccent } : undefined}>
                    {r.label}
                  </T>
                </View>
              ))}
            </View>
          </View>
        )}

        <CardPriceHistory oracleId={oracleId} />

        {d.printings.length > 0 && (
          <View style={{ gap: 4 }}>
            <T variant="label">
              {t("Ediciones", "Printings")} ({d.printings.length})
            </T>
            <View style={{ flexDirection: "row", paddingVertical: 4 }}>
              <T variant="small" style={{ flex: 1 }}>
                {t("Edición", "Printing")}
              </T>
              <T variant="small" style={{ width: 70, textAlign: "right" }}>
                Normal
              </T>
              <T variant="small" style={{ width: 70, textAlign: "right" }}>
                Foil
              </T>
            </View>
            {d.printings.slice(0, showAll ? undefined : 12).map((p) => (
              <Pressable
                key={p.scryfallId}
                onPress={() => setShown(p)}
                accessibilityLabel={t(
                  `Ver la edición ${p.setName ?? p.setCode}`,
                  `See the ${p.setName ?? p.setCode} printing`,
                )}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                  backgroundColor:
                    shown?.scryfallId === p.scryfallId || pressed ? colors.hover : "transparent",
                })}
              >
                <View style={{ flex: 1 }}>
                  <T numberOfLines={1}>
                    <T variant="mono">{p.setCode.toUpperCase()}</T> #{p.collectorNumber}
                  </T>
                  <T variant="small" numberOfLines={1}>
                    {p.setName ?? ""}
                    {p.releasedAt ? ` · ${p.releasedAt.slice(0, 4)}` : ""}
                  </T>
                </View>
                <T variant="mono" style={{ width: 70, textAlign: "right" }}>
                  {euros(p.priceEur)}
                </T>
                <T variant="mono" style={{ width: 70, textAlign: "right" }}>
                  {euros(p.priceEurFoil)}
                </T>
              </Pressable>
            ))}
            {!showAll && d.printings.length > 12 && (
              <Button
                label={t(`Ver las ${d.printings.length}`, `See all ${d.printings.length}`)}
                kind="ghost"
                onPress={() => setShowAll(true)}
              />
            )}
          </View>
        )}

        {d.commander && <CommanderStaples oracleId={oracleId} name={d.card.name} />}

        {d.commanderDecks.length > 0 && (
          <View style={{ gap: 8 }}>
            <T variant="label">
              {t("Mazos públicos con ella de comandante", "Public decks with it as commander")}
            </T>
            {d.commanderDecks.map((deck) => (
              <Pressable
                key={deck.id}
                onPress={() => router.push(`/deck/${deck.id}`)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.hover : colors.panel,
                  borderRadius: radius.md,
                  padding: 12,
                })}
              >
                <T style={{ fontWeight: "600" }}>{deck.name}</T>
                <T variant="small">{deck.owner ? `@${deck.owner}` : ""}</T>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet
        open={sheet === "add"}
        onClose={() => setSheet(null)}
        title={t("Añadir a la colección", "Add to collection")}
      >
        <AddPanel
          detail={d}
          initial={quickPrinting}
          defaults={defaults}
          onDefaults={setDefaults}
          onDone={(p) => {
            setShown(p);
            setSheet(null);
          }}
        />
      </Sheet>
      <LendSheet card={d.card} open={sheet === "lend"} onClose={() => setSheet(null)} />
      <AddToDeckSheet
        card={d.card}
        canBeCommander={d.commander}
        open={sheet === "deck"}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function PriceBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.panel, borderRadius: radius.md, padding: 10 }}>
      <T variant="small">{label}</T>
      <T style={{ fontWeight: "700", fontSize: 17 }}>{value}</T>
    </View>
  );
}

/** Una línea de mi colección (edición, foil, idioma, estado) con − / +. */
function LineRow({ line, onChanged }: { line: CollectionLineDTO; onChanged: () => void }) {
  const edit = useMutation({
    mutationFn: (quantity: number) =>
      api(`/api/collection/lines/${line.id}`, { method: "PATCH", body: { quantity } }),
    onSuccess: onChanged,
    onError: (e) => toast(`No se ha podido cambiar: ${e.message}`),
  });
  const change = (q: number) => {
    if (q === 0) {
      alert("¿Quitar estas copias?", "Se borran de tu colección.", [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        { text: t("Quitar", "Remove"), style: "destructive", onPress: () => edit.mutate(0) },
      ]);
    } else edit.mutate(q);
  };
  const p = line.printing;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.panel,
        borderRadius: radius.md,
        padding: 10,
      }}
    >
      <CardThumb uri={line.card.imageUrl} width={36} name={line.card.name} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <T style={{ fontWeight: "600" }}>
            {p
              ? `${p.setCode.toUpperCase()} #${p.collectorNumber}`
              : t("Edición sin indicar", "Printing not specified")}
          </T>
          {line.foil && <FoilMark />}
        </View>
        <T variant="small" numberOfLines={1}>
          {[
            p?.setName,
            line.language?.toUpperCase(),
            conditionShort(line.condition),
            euros(line.unitPrice),
          ]
            .filter(Boolean)
            .join(" · ")}
        </T>
      </View>
      <Stepper value={line.quantity} onChange={change} disabled={edit.isPending} />
    </View>
  );
}

/** Añadir copias eligiendo edición, cantidad, foil, idioma y estado (recuerda idioma y estado). */
function AddPanel({
  detail,
  initial,
  defaults,
  onDefaults,
  onDone,
}: {
  detail: CardDetailDTO;
  initial: PrintingDTO | null;
  defaults: { language: string; condition: string };
  onDefaults: (d: { language: string; condition: string }) => void;
  onDone: (printing: PrintingDTO | null) => void;
}) {
  const printings = useMemo(
    () => detail.printings.filter((p) => p.imageUrl || p.priceEur),
    [detail],
  );
  const [printing, setPrinting] = useState<PrintingDTO | null>(initial ?? printings[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [foil, setFoil] = useState(false);
  const [language, setLanguage] = useState(defaults.language);
  const [condition, setCondition] = useState(defaults.condition);
  const add = useAddCopies();
  const price = printing ? (foil ? printing.priceEurFoil : printing.priceEur) : null;

  const submit = () => {
    onDefaults({ language, condition });
    add.mutate(
      {
        oracleId: detail.card.oracleId,
        scryfallId: printing?.scryfallId,
        printingLabel: printing
          ? `${printing.setCode.toUpperCase()} #${printing.collectorNumber}`
          : undefined,
        quantity,
        foil,
        language,
        condition,
      },
      { onSuccess: () => onDone(printing) },
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <T variant="label">{t("Edición", "Printing")}</T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {printings.map((p) => {
          const on = p.scryfallId === printing?.scryfallId;
          return (
            <Pressable
              key={p.scryfallId}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${p.setName ?? p.setCode} ${p.collectorNumber}`}
              onPress={() => setPrinting(p)}
              style={{
                padding: 6,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: on ? colors.accent : "transparent",
                backgroundColor: colors.raised,
                alignItems: "center",
                gap: 4,
                width: 84,
              }}
            >
              <CardThumb uri={p.imageUrl} width={68} />
              <T variant="small" style={{ fontWeight: "600" }} numberOfLines={1}>
                {p.setCode.toUpperCase()} #{p.collectorNumber}
              </T>
              <T variant="mono" style={{ fontSize: 11 }}>
                {euros(p.priceEur)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      {printing?.setName && <T variant="small">{printing.setName}</T>}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T variant="label">{t("Copias", "Copies")}</T>
        <Stepper value={quantity} onChange={setQuantity} min={1} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip label="Normal" active={!foil} onPress={() => setFoil(false)} />
        <Chip label="★ Foil" active={foil} onPress={() => setFoil(true)} />
        <View style={{ flex: 1 }} />
        <T variant="mono" style={{ alignSelf: "center" }}>
          {euros(price)}
        </T>
      </View>
      <T variant="label">{t("Idioma", "Language")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {LANGUAGE_OPTIONS.map((l) => (
          <Chip
            key={l.code}
            label={l.label}
            active={language === l.code}
            onPress={() => setLanguage(l.code)}
          />
        ))}
      </View>
      <T variant="label">{t("Estado", "Condition")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {CONDITION_OPTIONS.map((c) => (
          <Chip
            key={c.code}
            label={c.label}
            active={condition === c.code}
            onPress={() => setCondition(c.code)}
          />
        ))}
      </View>
      <Button
        label={
          quantity === 1
            ? t("Añadir 1 copia", "Add 1 copy")
            : t(`Añadir ${quantity} copias`, `Add ${quantity} copies`)
        }
        icon="add"
        onPress={submit}
        busy={add.isPending}
      />
    </View>
  );
}
