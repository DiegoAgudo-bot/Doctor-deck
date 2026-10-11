import type { ListedCard } from "./lists";

/** Qué copia concreta es: carta, impresión, foil e idioma (lo que tiene precio propio). */
export interface CopyKey {
  oracleId: string;
  scryfallId: string | null;
  foil: boolean;
  language: string | null;
}

/** Unas copias iguales de una carta, con su precio por copia (EUR; null si no hay). */
export interface TradeCopy extends CopyKey {
  quantity: number;
  unitPrice: number | null;
}

/** Una línea de la colección (lo que hace falta para saber qué copias tengo). */
export interface OwnedCopies extends CopyKey {
  quantity: number;
}

export const copyKey = (c: CopyKey) =>
  `${c.oracleId}|${c.scryfallId?.toLowerCase() ?? ""}|${c.foil ? "f" : ""}|${c.language ?? ""}`;

const round = (n: number) => Math.round(n * 100) / 100;

/** Valor (EUR) de unas copias; las que no tienen precio no suman. */
export const copiesValue = (copies: readonly TradeCopy[]) =>
  round(copies.reduce((n, c) => n + (c.unitPrice ?? 0) * c.quantity, 0));

/** Suma las líneas iguales (misma carta, impresión, foil e idioma). */
function merge<T extends CopyKey & { quantity: number }>(items: readonly T[]): T[] {
  const out = new Map<string, T>();
  for (const i of items) {
    const k = copyKey(i);
    const prev = out.get(k);
    if (prev) out.set(k, { ...prev, quantity: prev.quantity + i.quantity });
    else out.set(k, { ...i });
  }
  return [...out.values()];
}

/**
 * Mis copias para cambiar, una a una: de cada carta de mi lista "para cambiar" (que ya descuenta
 * lo usado en mis mazos, las básicas y las que no cambio), qué copias concretas son. Se supone
 * que en los mazos están las más baratas, así que se ofrecen las de más valor.
 */
export function buildTradeCopies(input: {
  owned: readonly OwnedCopies[];
  tradelist: readonly ListedCard[];
  priceOf: (copy: CopyKey) => number | null;
}): TradeCopy[] {
  const byCard = new Map<string, TradeCopy[]>();
  for (const line of merge(input.owned)) {
    const list = byCard.get(line.oracleId) ?? [];
    list.push({ ...line, unitPrice: input.priceOf(line) });
    byCard.set(line.oracleId, list);
  }
  const out: TradeCopy[] = [];
  for (const { oracleId, quantity: free } of input.tradelist) {
    let left = free;
    const copies = (byCard.get(oracleId) ?? []).sort(
      (a, b) => (b.unitPrice ?? -1) - (a.unitPrice ?? -1),
    );
    for (const c of copies) {
      if (left <= 0) break;
      const q = Math.min(left, c.quantity);
      out.push({ ...c, quantity: q });
      left -= q;
    }
  }
  return out;
}

/** De unas copias, las que cubren lo que pide alguien (las más baratas primero). */
function pick(wanted: readonly ListedCard[], offered: readonly TradeCopy[]): TradeCopy[] {
  const byCard = new Map<string, TradeCopy[]>();
  for (const c of offered) byCard.set(c.oracleId, [...(byCard.get(c.oracleId) ?? []), c]);
  const out: TradeCopy[] = [];
  for (const w of wanted) {
    let left = w.quantity;
    const copies = [...(byCard.get(w.oracleId) ?? [])].sort(
      (a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0),
    );
    for (const c of copies) {
      if (left <= 0) break;
      const q = Math.min(left, c.quantity);
      out.push({ ...c, quantity: q });
      left -= q;
    }
  }
  return out;
}

export interface TradeSides {
  /** Lo que doy yo. */
  give: TradeCopy[];
  /** Lo que recibo. */
  get: TradeCopy[];
}

/**
 * Propuesta inicial: le doy lo que tengo para cambiar que está en su lista de deseos y recibo lo
 * que tiene para cambiar que está en la mía. Cada uno da sus copias más baratas de cada carta.
 */
export function proposeTrade(input: {
  myWishlist: readonly ListedCard[];
  myCopies: readonly TradeCopy[];
  theirWishlist: readonly ListedCard[];
  theirCopies: readonly TradeCopy[];
}): TradeSides {
  return {
    give: pick(input.theirWishlist, input.myCopies),
    get: pick(input.myWishlist, input.theirCopies),
  };
}

/** Diferencia que se da por buena: el 5 % del lado que más vale o 1 €, lo que sea mayor. */
export const DEFAULT_TOLERANCE = { percent: 0.05, minEur: 1 } as const;

export const tradeTolerance = (
  giveValue: number,
  getValue: number,
  t: { percent: number; minEur: number } = DEFAULT_TOLERANCE,
) => round(Math.max(t.minEur, Math.max(giveValue, getValue) * t.percent));

export interface TradeBalance {
  giveValue: number;
  getValue: number;
  /** Lo que recibo − lo que doy (positivo: salgo ganando). */
  diff: number;
  tolerance: number;
  balanced: boolean;
}

export function tradeBalance(sides: TradeSides, t = DEFAULT_TOLERANCE): TradeBalance {
  const giveValue = copiesValue(sides.give);
  const getValue = copiesValue(sides.get);
  const diff = round(getValue - giveValue);
  const tolerance = tradeTolerance(giveValue, getValue, t);
  return { giveValue, getValue, diff, tolerance, balanced: Math.abs(diff) <= tolerance };
}

/**
 * Cuadra el valor: mientras un lado valga más que el otro por encima de la tolerancia, quita de
 * ese lado la copia más cara que no haga pasarse al otro extremo (que la diferencia no cambie de
 * signo más allá de la tolerancia). Nunca deja un lado sin cartas. Si no hay ninguna que quitar,
 * para: lo que quede lo cuadran a mano.
 */
export function balanceTrade(sides: TradeSides, t = DEFAULT_TOLERANCE): TradeSides {
  const give = sides.give.map((c) => ({ ...c }));
  const get = sides.get.map((c) => ({ ...c }));
  for (;;) {
    const b = tradeBalance({ give, get }, t);
    if (b.balanced) break;
    const heavy = b.diff > 0 ? get : give;
    const excess = Math.abs(b.diff);
    // Nunca se deja un lado vacío: eso ya no sería un intercambio.
    if (heavy.reduce((n, c) => n + c.quantity, 0) <= 1) break;
    let best = -1;
    heavy.forEach((c, i) => {
      const p = c.unitPrice ?? 0;
      if (c.quantity <= 0 || p <= 0 || p > excess + b.tolerance) return;
      if (best < 0 || p > (heavy[best]?.unitPrice ?? 0)) best = i;
    });
    const copy = heavy[best];
    if (!copy) break;
    copy.quantity -= 1;
  }
  return { give: give.filter((c) => c.quantity > 0), get: get.filter((c) => c.quantity > 0) };
}

export interface ItemProblem {
  key: string;
  oracleId: string;
  /** Copias pedidas y las que hay disponibles. */
  wanted: number;
  available: number;
}

/**
 * Comprueba que unas líneas (de una propuesta editada a mano) caben en las copias disponibles y
 * les pone el precio de esas copias. Devuelve las líneas con precio y las que no caben.
 */
export function priceItems(
  items: readonly (CopyKey & { quantity: number })[],
  available: readonly TradeCopy[],
): { items: TradeCopy[]; problems: ItemProblem[] } {
  const avail = new Map(merge(available).map((c) => [copyKey(c), c]));
  const problems: ItemProblem[] = [];
  const out: TradeCopy[] = [];
  for (const item of merge(items)) {
    if (item.quantity <= 0) continue;
    const key = copyKey(item);
    const a = avail.get(key);
    if (!a || a.quantity < item.quantity) {
      problems.push({
        key,
        oracleId: item.oracleId,
        wanted: item.quantity,
        available: a?.quantity ?? 0,
      });
      continue;
    }
    out.push({ ...a, quantity: item.quantity });
  }
  return { items: out, problems };
}
