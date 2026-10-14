import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type {
  ProposalStatusDTO,
  TradeBalanceDTO,
  TradeCardDTO,
  TradeCopyDTO,
  TradePartnerDTO,
} from "@/server/dto";
import { euros } from "~/lib/format";
import { colors, radius } from "~/lib/theme";
import { CardThumb, FoilMark } from "./card-bits";
import { Card } from "./social";
import { Button, T } from "./ui";

export const STATUS_LABEL: Record<ProposalStatusDTO, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  cancelled: "Retirada",
};

export const STATUS_COLOR: Record<ProposalStatusDTO, string> = {
  draft: colors.text3,
  pending: colors.warn,
  accepted: colors.in,
  rejected: colors.out,
  cancelled: colors.text3,
};

/** Una carta de una lista de intercambio: miniatura, nombre, copias y precio. */
export function TradeCardRow({ item, right }: { item: TradeCardDTO; right?: ReactNode }) {
  return (
    <Pressable
      onPress={() => router.push(`/card/${item.card.oracleId}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 6,
        backgroundColor: pressed ? colors.hover : "transparent",
      })}
    >
      <CardThumb uri={item.card.imageUrl} width={34} name={item.card.name} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>
          {item.quantity > 1 ? `${item.quantity}× ` : ""}
          {item.card.name}
        </T>
        <T variant="mono">{euros(item.price)}</T>
      </View>
      {right}
    </Pressable>
  );
}

/** Cruce con otra persona: lo que tiene que busco y lo que busca que tengo. */
export function PartnerCard({ p }: { p: TradePartnerDTO }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T
            variant="h2"
            style={{ color: colors.accent }}
            onPress={() => router.push(`/u/${p.profile.username}`)}
          >
            @{p.profile.username}
          </T>
          <T variant="small">
            {p.profile.name}
            {p.following ? " · le sigues" : ""}
          </T>
        </View>
        <Button
          label="Proponer"
          icon="swap-horizontal-outline"
          onPress={() => router.push(`/trades/with/${p.profile.username}`)}
        />
      </View>
      <T variant="label">
        Tiene lo que buscas{p.haveValue > 0 ? ` · ≈ ${euros(p.haveValue)}` : ""}
      </T>
      {p.theyHave.length === 0 ? (
        <T variant="muted">Nada de tu lista de deseos.</T>
      ) : (
        p.theyHave.slice(0, 8).map((c) => <TradeCardRow key={c.card.oracleId} item={c} />)
      )}
      {p.theyHave.length > 8 && <T variant="small">y {p.theyHave.length - 8} más</T>}
      <T variant="label">
        Busca lo que te sobra{p.wantValue > 0 ? ` · ≈ ${euros(p.wantValue)}` : ""}
      </T>
      {p.theyWant.length === 0 ? (
        <T variant="muted">Nada de lo que tienes para cambiar.</T>
      ) : (
        p.theyWant.slice(0, 8).map((c) => <TradeCardRow key={c.card.oracleId} item={c} />)
      )}
      {p.theyWant.length > 8 && <T variant="small">y {p.theyWant.length - 8} más</T>}
    </Card>
  );
}

/** Lo que doy, lo que recibo y si está cuadrado (si se puede editar, qué hacer para cuadrarlo). */
export function BalanceBar({
  balance,
  partner,
  editable,
}: {
  balance: TradeBalanceDTO;
  partner: string;
  editable: boolean;
}) {
  const off = Math.abs(balance.diff);
  return (
    <View
      style={{
        gap: 6,
        padding: 12,
        borderRadius: radius.md,
        backgroundColor: colors.panel,
        borderWidth: 1,
        borderColor: balance.balanced ? colors.in : colors.warn,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1 }}>
          <T variant="small">Das</T>
          <T variant="h2">{euros(balance.giveValue)}</T>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <T variant="small">Recibes</T>
          <T variant="h2">{euros(balance.getValue)}</T>
        </View>
      </View>
      <T
        variant="small"
        style={{ color: balance.balanced ? colors.in : colors.warn, fontWeight: "700" }}
      >
        {balance.balanced
          ? `Cuadrado${off > 0 ? ` (±${euros(off)})` : ""}`
          : balance.diff > 0
            ? `Sales ganando ${euros(off)}${editable ? `: añade algo para @${partner}` : ""}`
            : `Das ${euros(off)} de más${editable ? `: pide algo más a @${partner}` : ""}`}
      </T>
    </View>
  );
}

/** Edición, foil e idioma de una copia («C21 #263 · ★ · ES»). */
export const copyLabel = (c: TradeCopyDTO) =>
  [
    c.printing ? `${c.printing.setCode.toUpperCase()} #${c.printing.collectorNumber}` : null,
    c.language && c.language !== "en" ? c.language.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Una copia en el editor de una propuesta, con − / + si se puede editar. */
export function CopyRow({
  copy,
  quantity,
  max,
  onChange,
}: {
  copy: TradeCopyDTO;
  quantity: number;
  max?: number;
  onChange?: ((q: number) => void) | undefined;
}) {
  const label = copyLabel(copy);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Pressable onPress={() => router.push(`/card/${copy.card.oracleId}`)}>
        <CardThumb uri={copy.card.imageUrl} width={34} name={copy.card.name} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{copy.card.name}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {copy.foil && <FoilMark />}
          {label ? <T variant="small">{label}</T> : null}
          <T variant="mono">{euros(copy.unitPrice)}</T>
        </View>
      </View>
      {onChange ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MiniButton label="−" onPress={() => onChange(quantity - 1)} disabled={quantity <= 0} />
          <T style={{ minWidth: 20, textAlign: "center", fontWeight: "700" }}>{quantity}</T>
          <MiniButton
            label="+"
            onPress={() => onChange(quantity + 1)}
            disabled={max !== undefined && quantity >= max}
          />
        </View>
      ) : (
        <T style={{ fontWeight: "700" }}>×{quantity}</T>
      )}
    </View>
  );
}

function MiniButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Una más" : "Una menos"}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.hover : colors.raised,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <T style={{ fontSize: 18 }}>{label}</T>
    </Pressable>
  );
}
