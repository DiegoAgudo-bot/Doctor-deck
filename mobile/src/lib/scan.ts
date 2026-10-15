/**
 * Lógica del escáner que no depende de la cámara (se prueba con node:test): ordenar las líneas
 * que lee el OCR y decidir cuándo una carta está reconocida de verdad.
 */

/** Lo mínimo que da el OCR de cada línea. */
export interface OcrLine {
  lineText: string;
  lineFrame: { x: number; y: number; height: number };
}

/** Las líneas de arriba abajo (y de izquierda a derecha si están a la misma altura). */
export function orderLines(blocks: readonly { lines: readonly OcrLine[] }[]): string[] {
  const lines = blocks.flatMap((b) => b.lines);
  return [...lines]
    .sort((a, b) => {
      const sameRow =
        Math.abs(a.lineFrame.y - b.lineFrame.y) <
        Math.min(a.lineFrame.height, b.lineFrame.height) / 2;
      return sameRow ? a.lineFrame.x - b.lineFrame.x : a.lineFrame.y - b.lineFrame.y;
    })
    .map((l) => l.lineText.trim())
    .filter((t) => t.length > 0)
    .slice(0, 40);
}

/** Lo que devuelve el servidor, reducido a lo que necesita el seguimiento. */
export interface Recognized {
  oracleId: string;
  /** Impresión exacta (edición + número), si se ha leído. */
  scryfallId: string | null;
  confidence: number;
}

export type TrackerEvent =
  /** Carta nueva reconocida: añadirla a la lista. */
  | { kind: "accept"; card: Recognized }
  /** La misma carta que sigue delante, ahora con la impresión exacta: corregir la última. */
  | { kind: "upgrade"; card: Recognized };

export interface TrackerOptions {
  /** Lecturas iguales seguidas que hacen falta si no es casi segura. */
  agree: number;
  /** A partir de esta confianza basta una lectura (edición + número y el nombre de acuerdo). */
  sureAt: number;
  /** Tiempo sin ver la carta para contarla otra vez (quitarla y volver a ponerla). */
  goneMs: number;
}

export const TRACKER_DEFAULTS: TrackerOptions = { agree: 2, sureAt: 0.95, goneMs: 700 };

/**
 * Decide cuándo aceptar una carta. Para no equivocarse, pide que dos lecturas seguidas digan lo
 * mismo (o una sola si es casi segura); para no contarla dos veces, la misma carta solo vuelve a
 * contar si ha dejado de verse un rato (como ManaBox: se quita y se pone otra copia).
 */
export class ScanTracker {
  private candidate: { oracleId: string; count: number } | null = null;
  private current: { oracleId: string; scryfallId: string | null } | null = null;
  private goneSince: number | null = null;
  private readonly options: TrackerOptions;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...TRACKER_DEFAULTS, ...options };
  }

  /** Una lectura nueva (null = no se reconoce nada delante). */
  observe(card: Recognized | null, now: number): TrackerEvent | null {
    if (!card) {
      this.candidate = null;
      if (this.current && this.goneSince === null) this.goneSince = now;
      return null;
    }
    const isCurrent = this.current?.oracleId === card.oracleId;
    const gone = this.goneSince !== null && now - this.goneSince >= this.options.goneMs;

    if (isCurrent && !gone) {
      this.goneSince = null;
      this.candidate = null;
      // Sigue delante: si ahora sí se lee la impresión exacta, se corrige la que se añadió.
      if (card.scryfallId && card.scryfallId !== this.current!.scryfallId) {
        this.current = { oracleId: card.oracleId, scryfallId: card.scryfallId };
        return { kind: "upgrade", card };
      }
      return null;
    }
    if (!isCurrent && this.current && this.goneSince === null) this.goneSince = now;

    const count = this.candidate?.oracleId === card.oracleId ? this.candidate.count + 1 : 1;
    this.candidate = { oracleId: card.oracleId, count };
    if (count < this.options.agree && card.confidence < this.options.sureAt) return null;

    this.current = { oracleId: card.oracleId, scryfallId: card.scryfallId };
    this.goneSince = null;
    this.candidate = null;
    return { kind: "accept", card };
  }

  /** Olvidar la carta actual (p. ej. al quitarla de la lista): se puede volver a escanear ya. */
  reset() {
    this.candidate = null;
    this.current = null;
    this.goneSince = null;
  }
}

/** Una carta escaneada que todavía no se ha añadido a la colección. */
export interface ScannedCopy {
  oracleId: string;
  scryfallId: string | null;
  name: string;
  /** «C21 #263» si se sabe la impresión. */
  printingLabel: string | null;
  imageUrl: string | null;
  /** Precio de referencia por copia. */
  price: number | null;
  quantity: number;
  foil: boolean;
  language: string;
  condition: string;
}

const sameCopy = (a: ScannedCopy, b: ScannedCopy) =>
  a.oracleId === b.oracleId &&
  a.scryfallId === b.scryfallId &&
  a.foil === b.foil &&
  a.language === b.language &&
  a.condition === b.condition;

/** Añade una copia a la lista: si ya está igual (misma impresión, foil, idioma), suma y sube. */
export function addScanned(list: readonly ScannedCopy[], copy: ScannedCopy): ScannedCopy[] {
  const i = list.findIndex((c) => sameCopy(c, copy));
  if (i === -1) return [copy, ...list];
  const merged = { ...list[i]!, quantity: list[i]!.quantity + copy.quantity };
  return [merged, ...list.slice(0, i), ...list.slice(i + 1)];
}

/**
 * La carta de arriba se reconoció por el nombre y ahora se lee la impresión exacta: se le pone
 * (una sola copia; si había más, la nueva va aparte).
 */
export function upgradeLatest(
  list: readonly ScannedCopy[],
  oracleId: string,
  printing: Pick<ScannedCopy, "scryfallId" | "printingLabel" | "imageUrl" | "price">,
): ScannedCopy[] {
  const top = list[0];
  if (!top || top.oracleId !== oracleId || top.scryfallId === printing.scryfallId) return [...list];
  const upgraded = { ...top, ...printing, quantity: 1 };
  const rest =
    top.quantity > 1 ? [{ ...top, quantity: top.quantity - 1 }, ...list.slice(1)] : list.slice(1);
  return addScanned(rest, upgraded);
}

/** Copias y valor de la lista. */
export function scannedTotals(list: readonly ScannedCopy[]) {
  return list.reduce(
    (t, c) => ({ copies: t.copies + c.quantity, value: t.value + (c.price ?? 0) * c.quantity }),
    { copies: 0, value: 0 },
  );
}
