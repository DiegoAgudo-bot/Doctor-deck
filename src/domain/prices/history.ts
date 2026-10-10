/** Precio de una carta en un día ("YYYY-MM-DD", UTC). */
export interface PricePoint {
  date: string;
  eur: number;
}

/** "YYYY-MM-DD" de hace `days` días respecto a `today` (también "YYYY-MM-DD"). */
export function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface PriceChange {
  now: number;
  /** El precio más antiguo dentro del periodo (o null si solo hay un día). */
  before: number | null;
  /** Diferencia en EUR y en % (null si no hay con qué comparar). */
  delta: number | null;
  percent: number | null;
}

/** Cambio de precio entre el primer y el último punto del histórico (ordenado por fecha). */
export function priceChange(history: readonly PricePoint[]): PriceChange | null {
  const last = history.at(-1);
  if (!last) return null;
  const first = history[0];
  if (!first || first.date === last.date)
    return { now: last.eur, before: null, delta: null, percent: null };
  const delta = round2(last.eur - first.eur);
  return {
    now: last.eur,
    before: first.eur,
    delta,
    percent: first.eur > 0 ? Math.round(((last.eur - first.eur) / first.eur) * 1000) / 10 : null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PriceMover {
  oracleId: string;
  copies: number;
  change: PriceChange & { before: number; delta: number };
  /** Lo que ha cambiado el valor de mis copias (delta × copias). */
  valueDelta: number;
}

/**
 * Las cartas de mi colección que más han subido y bajado (por lo que cambia el valor de mis
 * copias). Solo las que tienen al menos dos días de histórico en el periodo.
 */
export function priceMovers(
  owned: ReadonlyMap<string, number>,
  histories: ReadonlyMap<string, readonly PricePoint[]>,
  limit: number,
): { up: PriceMover[]; down: PriceMover[] } {
  const movers: PriceMover[] = [];
  for (const [oracleId, copies] of owned) {
    const change = priceChange(histories.get(oracleId) ?? []);
    if (!change || change.before === null || change.delta === null || change.delta === 0) continue;
    movers.push({
      oracleId,
      copies,
      change: { ...change, before: change.before, delta: change.delta },
      valueDelta: round2(change.delta * copies),
    });
  }
  return {
    up: movers
      .filter((m) => m.valueDelta > 0)
      .sort((a, b) => b.valueDelta - a.valueDelta)
      .slice(0, limit),
    down: movers
      .filter((m) => m.valueDelta < 0)
      .sort((a, b) => a.valueDelta - b.valueDelta)
      .slice(0, limit),
  };
}

/**
 * Valor de la colección cada día: suma de copias × precio de ese día. Si a una carta le falta el
 * precio de un día, se usa el último conocido (para que no haya bajones falsos).
 */
export function collectionValueSeries(
  owned: ReadonlyMap<string, number>,
  histories: ReadonlyMap<string, readonly PricePoint[]>,
): PricePoint[] {
  const dates = [...new Set([...histories.values()].flatMap((h) => h.map((p) => p.date)))].sort();
  const totals = new Map(dates.map((d) => [d, 0]));
  for (const [oracleId, copies] of owned) {
    const history = histories.get(oracleId) ?? [];
    let i = 0;
    let last: number | null = null;
    for (const date of dates) {
      while (i < history.length && history[i]!.date <= date) last = history[i++]!.eur;
      if (last !== null) totals.set(date, (totals.get(date) ?? 0) + last * copies);
    }
  }
  return dates.map((date) => ({ date, eur: round2(totals.get(date) ?? 0) }));
}

export interface PriceDrop {
  oracleId: string;
  now: number;
  /** Máximo del periodo de referencia (sin contar hoy). */
  reference: number;
  /** % que ha bajado (positivo). */
  percent: number;
}

/**
 * ¿Ha bajado al menos `thresholdPercent` respecto al máximo de los días anteriores? El histórico
 * es el del periodo de referencia (p. ej. 30 días) e incluye hoy como último punto.
 */
export function priceDrop(
  oracleId: string,
  history: readonly PricePoint[],
  thresholdPercent: number,
): PriceDrop | null {
  const today = history.at(-1);
  const previous = history.slice(0, -1);
  if (!today || previous.length === 0) return null;
  const reference = Math.max(...previous.map((p) => p.eur));
  if (reference <= 0) return null;
  const percent = Math.round(((reference - today.eur) / reference) * 1000) / 10;
  return percent >= thresholdPercent ? { oracleId, now: today.eur, reference, percent } : null;
}
