import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { AnalyzeResponse, CardDTO, DeckViewDTO } from "@/server/dto";
import { curveByColor, deckSummary, type CurveSeg } from "@/domain/deck/color-curve";
import { alert } from "~/components/dialog";
import { toast } from "~/components/toast";
import { Button, Chip, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { thousands } from "~/lib/format";
import { intl, t } from "~/lib/i18n";
import { colors, manaColors, radius } from "~/lib/theme";

type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;

const SEG_COLOR: Record<CurveSeg, string> = {
  w: manaColors.W!,
  u: manaColors.U!,
  b: manaColors.B!,
  r: manaColors.R!,
  g: manaColors.G!,
  m: "#d9c27a",
  c: manaColors.C!,
};
const SEG_LABEL: Record<CurveSeg, string> = {
  w: t("Blanco", "White"),
  u: t("Azul", "Blue"),
  b: t("Negro", "Black"),
  r: t("Rojo", "Red"),
  g: t("Verde", "Green"),
  m: t("Multicolor", "Multicolor"),
  c: t("Incoloro", "Colorless"),
};

const allCards = (a: Analysis) => [
  ...a.commanders.map((card) => ({ card, quantity: 1 })),
  ...a.cards,
];

/** Curva de maná apilada por color (como en la web) y el resumen: tierras, hechizos y coste medio. */
export function CurvePanel({ analysis: a }: { analysis: Analysis }) {
  const cards = allCards(a);
  const curve = curveByColor(cards);
  const summary = deckSummary(cards);
  const rows: [string, string][] = [
    [t("Tierras", "Lands"), String(summary.lands)],
    [t("Hechizos", "Spells"), String(summary.spells)],
    [
      t("Coste medio (sin tierras)", "Avg. mana value (no lands)"),
      summary.averageCmc.toLocaleString(intl, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ],
  ];
  return (
    <View style={{ gap: 12 }}>
      <T variant="label">{t("Curva de maná", "Mana curve")}</T>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t("Curva de maná", "Mana curve")}: ${curve.columns
          .map((c, i) => `${i === 7 ? "7+" : i}: ${c.total}`)
          .join(", ")}`}
        style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 124 }}
      >
        {curve.columns.map((col, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <T variant="small">{col.total || ""}</T>
            <View
              style={{
                width: "100%",
                height: (col.total / curve.max) * 80,
                borderRadius: 3,
                overflow: "hidden",
                // De abajo arriba en el orden de los colores.
                flexDirection: "column-reverse",
              }}
            >
              {col.segs.map((s) => (
                <View key={s.seg} style={{ flex: s.count, backgroundColor: SEG_COLOR[s.seg] }} />
              ))}
            </View>
            <T variant="small">{i === 7 ? "7+" : i}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {curve.used.map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: SEG_COLOR[s] }} />
            <T variant="small">{SEG_LABEL[s]}</T>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: colors.panel, borderRadius: radius.md, padding: 12, gap: 6 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row" }}>
            <T variant="muted" style={{ flex: 1 }}>
              {label}
            </T>
            <T variant="mono">{value}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

interface CollectionCardInput {
  oracleId?: string;
  scryfallId?: string;
  quantity: number;
  foil?: boolean;
}

/** Lo que pide `POST /api/collection/cards` para una carta del mazo (con su edición y foil). */
const collectionInput = (card: CardDTO, quantity: number): CollectionCardInput => ({
  quantity,
  ...(card.printing ? { scryfallId: card.printing.scryfallId } : { oracleId: card.oracleId }),
  ...(card.foil ? { foil: true } : {}),
});

/**
 * «¿Tienes el mazo en físico?» (p. ej. un precon): vuelca a la colección todo el mazo o solo lo
 * que falta, como cartas sueltas con la edición del mazo.
 */
export function DeckToCollectionPanel({ analysis: a }: { analysis: Analysis }) {
  const qc = useQueryClient();
  const deckCards = [...a.commanders, ...a.cards.map((c) => c.card)];
  const all = [
    ...a.commanders.map((c) => collectionInput(c, 1)),
    ...a.cards.map((c) => collectionInput(c.card, c.quantity)),
  ];
  const missing = a.ownership.items
    .filter((i) => i.toBuy > 0)
    .map((i) =>
      collectionInput(deckCards.find((c) => c.oracleId === i.card.oracleId) ?? i.card, i.toBuy),
    );
  const copies = (xs: readonly CollectionCardInput[]) => xs.reduce((n, x) => n + x.quantity, 0);
  const n = { all: copies(all), missing: copies(missing) };
  const add = useMutation({
    mutationFn: (which: "all" | "missing") =>
      api("/api/collection/cards", { body: { cards: which === "all" ? all : missing } }),
    onSuccess: (_r, which) => {
      tapFeedback();
      toast(
        t(
          `Añadidas ${thousands(n[which])} copias a tu colección`,
          `Added ${thousands(n[which])} copies to your collection`,
        ),
      );
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: ["analysis"] });
    },
    onError: (e) => toast(e.message),
  });
  if (all.length === 0) return null;
  const ask = (which: "all" | "missing") =>
    alert(
      t(
        `¿Añadir ${thousands(n[which])} copias a tu colección?`,
        `Add ${thousands(n[which])} copies to your collection?`,
      ),
      which === "all"
        ? t(
            "Se suman todas las cartas del mazo (con su edición), también las que ya tienes: es para cuando compras el mazo entero, como un precon.",
            "Every card in the deck is added (with its printing), even the ones you already have: it's for when you buy the whole deck, like a precon.",
          )
        : t(
            "Se añaden las cartas que te faltan con la edición del mazo. Luego puedes editarlas o borrarlas en la colección.",
            "The cards you're missing are added with the deck's printing. You can edit or delete them later in the collection.",
          ),
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        { text: t("Añadir", "Add"), onPress: () => add.mutate(which) },
      ],
    );
  return (
    <View style={{ backgroundColor: colors.panel, borderRadius: radius.md, padding: 12, gap: 10 }}>
      <T style={{ fontWeight: "600" }}>
        {t("¿Tienes el mazo en físico?", "Own this deck in paper?")}
      </T>
      <T variant="small">
        {t(
          "Vuelca las cartas del mazo a tu colección con su edición.",
          "Add the deck's cards to your collection with their printing.",
        )}
      </T>
      {n.missing > 0 && n.missing < n.all && (
        <Button
          label={t(
            `Añadir lo que me falta (${thousands(n.missing)})`,
            `Add what I'm missing (${thousands(n.missing)})`,
          )}
          kind="secondary"
          disabled={add.isPending}
          onPress={() => ask("missing")}
        />
      )}
      <Button
        label={t(
          `Añadir todo a mi colección (${thousands(n.all)})`,
          `Add it all to my collection (${thousands(n.all)})`,
        )}
        kind="secondary"
        disabled={add.isPending}
        onPress={() => ask("all")}
      />
    </View>
  );
}

/**
 * Al final de «Cambios» en un mazo mío: las recomendadas que tengo pero están en otros mazos
 * (con «Proponerlas igualmente») y deshacer descartes y candados.
 */
export function ChangesFooter({
  deck,
  analysis: a,
  useOtherDecks,
  onUseOtherDecks,
  onClear,
  busy,
}: {
  deck: DeckViewDTO;
  analysis: Analysis;
  useOtherDecks: boolean;
  onUseOtherDecks: (v: boolean) => void;
  onClear: (what: "excluded" | "locked") => void;
  busy: boolean;
}) {
  const inOthers = a.unavailableCandidates;
  const showOthers = inOthers.length > 0 || !useOtherDecks;
  const marks = deck.excluded.length + deck.locked.length;
  if (!showOthers && marks === 0) return null;
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {showOthers && (
        <View
          style={{ backgroundColor: colors.panel, borderRadius: radius.md, padding: 12, gap: 8 }}
        >
          <T style={{ fontWeight: "600" }}>
            {t("En otros mazos", "In other decks")}
            {inOthers.length > 0 ? ` · ${inOthers.length}` : ""}
          </T>
          <T variant="small">
            {useOtherDecks
              ? t(
                  "Recomendadas que tienes, pero con todas las copias en otros mazos: no se proponen.",
                  "Recommended cards you own, but every copy is in another deck: they aren't suggested.",
                )
              : t(
                  "Se proponen también las cartas que usas en otros mazos.",
                  "Cards you use in other decks are suggested too.",
                )}
          </T>
          {inOthers.slice(0, 8).map((c) => (
            <Pressable
              key={c.card.oracleId}
              onPress={() => router.push(`/card/${c.card.oracleId}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inuse }}
              />
              <T numberOfLines={1} style={{ flexShrink: 1 }}>
                {c.card.name}
              </T>
              <T variant="small" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
                {c.usedIn?.join(", ") ?? ""}
              </T>
            </Pressable>
          ))}
          <View style={{ flexDirection: "row" }}>
            <Chip
              label={t("Proponerlas igualmente", "Suggest them anyway")}
              icon={useOtherDecks ? "square-outline" : "checkbox"}
              active={!useOtherDecks}
              onPress={() => onUseOtherDecks(!useOtherDecks)}
            />
          </View>
        </View>
      )}
      {marks > 0 && (
        <View
          style={{ backgroundColor: colors.panel, borderRadius: radius.md, padding: 12, gap: 10 }}
        >
          <T style={{ fontWeight: "600" }}>{t("Descartes y candados", "Dismissed and locked")}</T>
          {deck.excluded.length > 0 && (
            <Button
              label={t(
                `Volver a proponer las ${deck.excluded.length} descartadas`,
                `Suggest the ${deck.excluded.length} dismissed again`,
              )}
              kind="secondary"
              icon="refresh"
              disabled={busy}
              onPress={() => onClear("excluded")}
            />
          )}
          {deck.locked.length > 0 && (
            <Button
              label={t(
                `Quitar los ${deck.locked.length} candados`,
                `Remove the ${deck.locked.length} locks`,
              )}
              kind="secondary"
              icon="lock-open-outline"
              disabled={busy}
              onPress={() => onClear("locked")}
            />
          )}
        </View>
      )}
    </View>
  );
}
