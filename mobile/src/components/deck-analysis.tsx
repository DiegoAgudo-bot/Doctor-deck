import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { HAND_SIZE, openingHandOdds, shuffleLibrary } from "@/domain/deck/draw-odds";
import type {
  AnalyzeResponse,
  CardDTO,
  ComboCardDTO,
  ComboDTO,
  DeckCardDTO,
  DeckCombosDTO,
  DeckViewDTO,
  OwnershipDTO,
} from "@/server/dto";
import { CardThumb } from "~/components/card-bits";
import { Banner, Button, Field, Loading, T } from "~/components/ui";
import { api } from "~/lib/api";
import { euros } from "~/lib/format";
import { colors, radius } from "~/lib/theme";

type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;

const pct = (p: number) => `${Math.round(p * 100)} %`;

const STATUS: Record<"owned" | "in_other_decks" | "buy", { label: string; color: string }> = {
  owned: { label: "La tienes", color: colors.owned },
  in_other_decks: { label: "En otro mazo", color: colors.inuse },
  buy: { label: "Hay que comprarla", color: colors.missing },
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 8, backgroundColor: colors.panel, borderRadius: radius.md, padding: 12 }}>
    <T variant="label">{title}</T>
    {children}
  </View>
);

const openCard = (c: CardDTO | null) => c && router.push(`/card/${c.oracleId}`);

/** Nombre de una carta de un combo (con su miniatura si está en el catálogo). */
function ComboCard({ c, dim }: { c: ComboCardDTO; dim?: boolean }) {
  return (
    <Pressable
      onPress={() => openCard(c.card)}
      disabled={!c.card}
      style={{ alignItems: "center", width: 64, gap: 2, opacity: dim ? 0.5 : 1 }}
    >
      <CardThumb uri={c.card?.imageUrl} width={56} name={c.name} />
      <T variant="small" numberOfLines={2} style={{ textAlign: "center", fontSize: 10 }}>
        {c.name}
      </T>
    </Pressable>
  );
}

function ComboRow({ combo, missing }: { combo: ComboDTO; missing?: string }) {
  return (
    <View style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {combo.cards.map((c) => (
          <ComboCard key={c.name} c={c} dim={missing !== undefined && c.name !== missing} />
        ))}
      </View>
      {combo.produces.length > 0 && (
        <T variant="small">
          {combo.produces.slice(0, 4).join(" · ")}
          {combo.bracketTag === "R" ? " · sube a bracket 4" : ""}
        </T>
      )}
    </View>
  );
}

/**
 * Combos del mazo (aparte del análisis: tardan más): los que ya tiene, los que están a una
 * carta (y si la tengo, está en otro mazo o hay que comprarla) y las cartas clave.
 */
export function CombosPanel({
  data,
  loading,
  error,
}: {
  data: DeckCombosDTO | undefined;
  loading: boolean;
  error: Error | null;
}) {
  if (loading && !data) return <Loading label="Buscando combos…" />;
  if (error && !data) return <Banner text={error.message} />;
  if (!data) return null;
  return (
    <View style={{ gap: 12, paddingHorizontal: 16 }}>
      {data.warning && <Banner text={data.warning} />}
      <Panel title={`En el mazo (${data.included.length})`}>
        {data.included.length === 0 ? (
          <T variant="small">Ningún combo completo.</T>
        ) : (
          data.included.map((c) => <ComboRow key={c.id} combo={c} />)
        )}
      </Panel>
      {data.keyCards.length > 0 && (
        <Panel title="Cartas clave">
          <T variant="small">Las que más combos completarían si las metes.</T>
          {data.keyCards.slice(0, 8).map((k) => (
            <Pressable
              key={k.card.name}
              onPress={() => openCard(k.card.card)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 3 }}
            >
              <CardThumb uri={k.card.card?.imageUrl} width={30} name={k.card.name} />
              <T style={{ flex: 1 }} numberOfLines={1}>
                {k.card.name}
              </T>
              <T variant="small" style={{ color: STATUS[k.status].color }}>
                {k.status === "buy" ? euros(k.price) : STATUS[k.status].label}
              </T>
              <T variant="mono">{k.combos}</T>
            </Pressable>
          ))}
        </Panel>
      )}
      <Panel title={`A una carta (${data.oneAwayTotal})`}>
        {data.oneAway.length === 0 ? (
          <T variant="small">Ninguno.</T>
        ) : (
          data.oneAway.slice(0, 30).map((o) => (
            <View key={o.combo.id} style={{ gap: 2 }}>
              <T variant="small" style={{ color: STATUS[o.status].color }}>
                Falta {o.missing.name} · {STATUS[o.status].label}
                {o.status === "buy" && o.price !== null ? ` (${euros(o.price)})` : ""}
              </T>
              <ComboRow combo={o.combo} missing={o.missing.name} />
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}

const roleCount = (cards: DeckCardDTO[], role: DeckCardDTO["primaryRole"]) =>
  cards
    .filter((c) => c.roles.includes(role) && (role === "land" || !c.roles.includes("land")))
    .reduce((n, c) => n + c.quantity, 0);

/** Probabilidades de la mano inicial y «Robar 7» con mulligan (el primero, gratis). */
export function OpeningHandPanel({ cards }: { cards: DeckCardDTO[] }) {
  const odds = useMemo(
    () =>
      openingHandOdds({
        library: cards.reduce((n, c) => n + c.quantity, 0),
        lands: roleCount(cards, "land"),
        ramp: roleCount(cards, "ramp"),
        draw: roleCount(cards, "draw"),
      }),
    [cards],
  );
  const [library, setLibrary] = useState<DeckCardDTO[] | null>(null);
  const [mulligans, setMulligans] = useState(0);
  if (odds.library === 0) return null;
  const draw = (mulligan: boolean) => {
    setLibrary(shuffleLibrary(cards, Math.random));
    setMulligans((m) => (mulligan ? m + 1 : 0));
  };
  const hand = library?.slice(0, HAND_SIZE) ?? [];
  const lands = hand.filter((c) => c.roles.includes("land")).length;
  // London mulligan; en Commander el primero es gratis.
  const toBottom = Math.max(0, mulligans - 1);
  const row = (label: string, value: string) => (
    <View style={{ flexDirection: "row" }}>
      <T variant="small" style={{ flex: 1 }}>
        {label}
      </T>
      <T variant="mono">{value}</T>
    </View>
  );
  return (
    <Panel title={`Mano inicial · ${odds.lands} tierras en ${odds.library} cartas`}>
      {row("Mano de 2 a 4 tierras", pct(odds.keepable))}
      {row("3 tierras en el turno 3", pct(odds.landDropT3))}
      {row("4 tierras en el turno 4", pct(odds.landDropT4))}
      {row("Ramp en la mano / en el turno 2", `${pct(odds.rampInHand)} / ${pct(odds.rampByT2)}`)}
      {row("Robo en el turno 3", pct(odds.drawByT3))}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <Button label="Robar 7" icon="shuffle" onPress={() => draw(false)} style={{ flex: 1 }} />
        {library && (
          <Button
            label="Mulligan"
            kind="secondary"
            onPress={() => draw(true)}
            style={{ flex: 1 }}
          />
        )}
      </View>
      {library && (
        <>
          <T variant="small">
            {lands} {lands === 1 ? "tierra" : "tierras"}
            {mulligans > 0
              ? ` · mulligan ${mulligans}${toBottom > 0 ? `: pon ${toBottom} abajo` : " (gratis)"}`
              : ""}
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {hand.map((c, i) => (
              <Pressable key={`${c.card.oracleId}-${i}`} onPress={() => openCard(c.card)}>
                <CardThumb uri={c.card.imageUrl} width={72} name={c.card.name} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

/** Para lo caro que falta: otras cartas del mismo papel que tengo libres o cuestan mucho menos. */
export function AlternativesPanel({
  alternatives,
}: {
  alternatives: OwnershipDTO["alternatives"];
}) {
  if (alternatives.length === 0) return null;
  return (
    <Panel title="Alternativas más baratas">
      {alternatives.map((a) => (
        <View
          key={a.card.oracleId}
          style={{ gap: 4, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.line }}
        >
          <Pressable onPress={() => openCard(a.card)} style={{ flexDirection: "row", gap: 8 }}>
            <T style={{ flex: 1, fontWeight: "700" }} numberOfLines={1}>
              {a.card.name}
            </T>
            <T variant="mono">{euros(a.price)}</T>
          </Pressable>
          {a.alternatives.map((alt) => (
            <Pressable
              key={alt.card.oracleId}
              onPress={() => openCard(alt.card)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8 }}
            >
              <CardThumb uri={alt.card.imageUrl} width={26} name={alt.card.name} />
              <T variant="small" style={{ flex: 1 }} numberOfLines={1}>
                {alt.card.name}
              </T>
              <T
                variant="small"
                style={{ color: alt.owned ? colors.owned : colors.text2, fontWeight: "700" }}
              >
                {alt.owned ? "La tienes" : euros(alt.price)}
              </T>
            </Pressable>
          ))}
        </View>
      ))}
    </Panel>
  );
}

const num = (s: string): number | undefined => {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

/** «Si compro N cartas baratas, ¿cuáles mejoran más el mazo?» (modo compra de la web). */
export function BuyPanel({ deck, analysis: a }: { deck: DeckViewDTO; analysis: Analysis }) {
  const [maxCards, setMaxCards] = useState("5");
  const [maxPrice, setMaxPrice] = useState("2");
  const [budget, setBudget] = useState("");
  const run = useMutation({
    mutationFn: () =>
      api<AnalyzeResponse>("/api/analyze", {
        body: {
          input: deck.input,
          commanders: a.commanders.map((c) => c.oracleId),
          locked: deck.locked,
          excluded: deck.excluded,
          ...(a.edhrec.theme ? { theme: a.edhrec.theme } : {}),
          ...(deck.isMine ? { deckId: deck.id } : {}),
          buy: {
            maxCards: Math.min(30, Math.max(1, Math.round(num(maxCards) ?? 5))),
            ...(num(maxPrice) ? { maxPrice: num(maxPrice) } : {}),
            ...(num(budget) ? { budget: num(budget) } : {}),
          },
        },
      }),
  });
  const p = run.data?.status === "ok" ? run.data.purchases : null;
  return (
    <Panel title="Si compro unas pocas cartas baratas…">
      <T variant="small">
        ¿Qué cartas que no tienes mejoran más el mazo, con un precio máximo por carta y un
        presupuesto?
      </T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Cartas"
            value={maxCards}
            onChangeText={setMaxCards}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Máx. por carta (€)"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Presupuesto (€)"
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="sin límite"
          />
        </View>
      </View>
      <Button
        label="Buscar"
        icon="cart-outline"
        busy={run.isPending}
        onPress={() => run.mutate()}
      />
      {run.error && <Banner text={run.error.message} />}
      {p &&
        (p.items.length === 0 ? (
          <T variant="small">Ninguna carta así lo mejora: prueba a subir el precio máximo.</T>
        ) : (
          <>
            <T style={{ fontWeight: "700" }}>
              {p.items.length} {p.items.length === 1 ? "carta" : "cartas"} · {euros(p.totalCost)}
            </T>
            {p.items.map((s) => (
              <View key={s.id} style={{ gap: 2, paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CardThumb uri={s.in.card.imageUrl} width={30} name={s.in.card.name} />
                  <Pressable style={{ flex: 1 }} onPress={() => openCard(s.in.card)}>
                    <T numberOfLines={1}>{s.in.card.name}</T>
                    <T variant="small" numberOfLines={1}>
                      por {s.out.card.name}
                    </T>
                  </Pressable>
                  <T variant="mono">{euros(s.in.price ?? null)}</T>
                </View>
              </View>
            ))}
          </>
        ))}
    </Panel>
  );
}
