import { useMemo, useState } from "react";
import { View } from "react-native";
import type { TradeCopyDTO } from "@/server/dto";
import { euros } from "~/lib/format";
import { linesBalance, setLine, type Side, type TradeLine } from "~/lib/trade-lines";
import { colors } from "~/lib/theme";
import { Sheet } from "./sheet";
import { Card } from "./social";
import { BalanceBar, CopyRow } from "./trades";
import { Button, SearchField, T } from "./ui";

/**
 * Las dos partes de un intercambio (lo que doy y lo que recibo) con el balance arriba. Si es
 * editable, − / + por copia (sin pasar de las que hay para cambiar) y «Añadir más».
 */
export function TradeEditor({
  partner,
  lines,
  onChange,
  myCopies,
  theirCopies,
  unavailable = [],
}: {
  partner: string;
  lines: TradeLine[];
  /** Sin esto, solo lectura. */
  onChange?: ((lines: TradeLine[]) => void) | undefined;
  myCopies?: TradeCopyDTO[] | null | undefined;
  theirCopies?: TradeCopyDTO[] | null | undefined;
  unavailable?: readonly string[];
}) {
  const balance = useMemo(() => linesBalance(lines), [lines]);
  const [adding, setAdding] = useState<Side | null>(null);
  const editable = Boolean(onChange);
  const change = (side: Side) => (copy: TradeCopyDTO, quantity: number) =>
    onChange?.(setLine(lines, side, copy, quantity));
  const available = adding === "give" ? myCopies : adding === "get" ? theirCopies : null;

  const column = (side: Side, title: string, copies: TradeCopyDTO[] | null | undefined) => {
    const mine = lines.filter((l) => l.side === side);
    const value = mine.reduce((n, l) => n + (l.copy.unitPrice ?? 0) * l.quantity, 0);
    const max = (copy: TradeCopyDTO) =>
      copies?.find((a) => a.key === copy.key)?.quantity ?? copy.quantity;
    return (
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <T variant="h2" style={{ flex: 1 }}>
            {title}
          </T>
          <T variant="mono">{euros(value)}</T>
        </View>
        {mine.length === 0 ? (
          <T variant="muted">Ninguna carta.</T>
        ) : (
          mine.map((l) => (
            <View key={l.copy.key}>
              <CopyRow
                copy={l.copy}
                quantity={l.quantity}
                max={max(l.copy)}
                onChange={editable ? (q) => change(side)(l.copy, q) : undefined}
              />
              {unavailable.includes(l.copy.card.oracleId) && (
                <T variant="small" style={{ color: colors.out }}>
                  Ya no está en su lista para cambiar
                </T>
              )}
            </View>
          ))
        )}
        {editable && copies && (
          <Button label="Añadir más" icon="add" kind="ghost" onPress={() => setAdding(side)} />
        )}
      </Card>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <BalanceBar balance={balance} partner={partner} editable={editable} />
      {column("give", `Das a @${partner}`, myCopies)}
      {column("get", `Recibes de @${partner}`, theirCopies)}
      {adding && available && (
        <AddCopiesSheet
          title={adding === "give" ? `Dar a @${partner}` : `Pedir a @${partner}`}
          available={available}
          used={
            new Map(lines.filter((l) => l.side === adding).map((l) => [l.copy.key, l.quantity]))
          }
          onAdd={(copy, q) => change(adding)(copy, q)}
          onClose={() => setAdding(null)}
        />
      )}
    </View>
  );
}

function AddCopiesSheet({
  title,
  available,
  used,
  onAdd,
  onClose,
}: {
  title: string;
  available: TradeCopyDTO[];
  used: ReadonlyMap<string, number>;
  onAdd: (copy: TradeCopyDTO, quantity: number) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const addable = available
    .filter((a) => (used.get(a.key) ?? 0) < a.quantity)
    .filter((a) => !q || a.card.name.toLowerCase().includes(q));
  return (
    <Sheet open onClose={onClose} title={title}>
      <SearchField
        placeholder="Filtrar por nombre…"
        value={filter}
        onChangeText={setFilter}
        onClear={() => setFilter("")}
      />
      {addable.length === 0 ? (
        <T variant="muted">Nada más que añadir.</T>
      ) : (
        addable
          .slice(0, 100)
          .map((a) => (
            <CopyRow
              key={a.key}
              copy={a}
              quantity={used.get(a.key) ?? 0}
              max={a.quantity}
              onChange={(n) => onAdd(a, n)}
            />
          ))
      )}
      {addable.length > 100 && (
        <T variant="small">Hay {addable.length - 100} más: filtra por nombre.</T>
      )}
    </Sheet>
  );
}
