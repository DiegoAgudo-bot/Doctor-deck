import { tradeBalance, type TradeBalance } from "@/domain/trades/proposal";
import type { TradeCopyDTO } from "@/server/dto";

export type Side = "give" | "get";

/** Una línea de la propuesta en la pantalla: unas copias iguales y cuántas entran. */
export interface TradeLine {
  side: Side;
  copy: TradeCopyDTO;
  quantity: number;
}

/** Las líneas en el formato de la API (`proposalLinesSchema`). */
export const linesForApi = (lines: readonly TradeLine[]) =>
  lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      side: l.side,
      oracleId: l.copy.card.oracleId,
      scryfallId: l.copy.scryfallId,
      foil: l.copy.foil,
      language: l.copy.language,
      quantity: l.quantity,
    }));

export const toLines = (give: readonly TradeCopyDTO[], get: readonly TradeCopyDTO[]) => [
  ...give.map((copy) => ({ side: "give" as const, copy, quantity: copy.quantity })),
  ...get.map((copy) => ({ side: "get" as const, copy, quantity: copy.quantity })),
];

/** Balance con los precios de cada copia (la misma regla que el servidor, del dominio). */
export function linesBalance(lines: readonly TradeLine[]): TradeBalance {
  const side = (s: Side) =>
    lines
      .filter((l) => l.side === s && l.quantity > 0)
      .map((l) => ({
        oracleId: l.copy.card.oracleId,
        scryfallId: l.copy.scryfallId,
        foil: l.copy.foil,
        language: l.copy.language,
        quantity: l.quantity,
        unitPrice: l.copy.unitPrice,
      }));
  return tradeBalance({ give: side("give"), get: side("get") });
}

/** Cambia las copias de una línea (0 = quitarla). */
export function setLine(
  lines: readonly TradeLine[],
  side: Side,
  copy: TradeCopyDTO,
  quantity: number,
): TradeLine[] {
  const idx = lines.findIndex((l) => l.side === side && l.copy.key === copy.key);
  if (quantity <= 0) return lines.filter((_, i) => i !== idx);
  const line = { side, copy, quantity };
  return idx >= 0 ? lines.map((l, i) => (i === idx ? line : l)) : [...lines, line];
}
