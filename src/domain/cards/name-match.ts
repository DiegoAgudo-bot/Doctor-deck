import { nameKey } from "./names";

/** Un nombre que se puede leer en una carta (cada cara de una carta de dos caras va aparte). */
export interface NameEntry {
  oracleId: string;
  /** Nombre impreso (una cara). */
  name: string;
  /** Posición de popularidad (menor = más jugada): desempata nombres que se leen igual. */
  rank?: number | null | undefined;
}

export interface NameMatch {
  oracleId: string;
  name: string;
  /** Parecido entre 0 y 1 (1 = idéntico tras normalizar). */
  score: number;
}

/**
 * Clave para comparar lo que lee la cámara: sin tildes, mayúsculas ni signos (el OCR se come las
 * comas y los apóstrofos y confunde las comillas), con un solo espacio entre palabras.
 */
export function scanKey(text: string): string {
  return nameKey(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(key: string): string[] {
  const padded = `  ${key} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return [...out];
}

/** Distancia de edición (Levenshtein) con dos filas. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}

const similarity = (a: string, b: string) =>
  1 - editDistance(a, b) / Math.max(a.length, b.length, 1);

/**
 * Índice de nombres para reconocer cartas por lo que lee la cámara: trigramas para quedarse con
 * unos pocos candidatos y distancia de edición para ordenarlos. Tolera letras mal leídas y basura
 * pegada al final (el coste de maná al lado del nombre: "Sol Ring 1").
 */
export class NameIndex {
  private readonly keys: string[] = [];
  private readonly entries: NameEntry[] = [];
  private readonly postings = new Map<string, number[]>();
  private readonly gramCount: number[] = [];
  private counts = new Uint16Array(0);

  constructor(entries: Iterable<NameEntry>) {
    const seen = new Set<string>();
    for (const e of entries) {
      const key = scanKey(e.name);
      if (key.length < 2 || seen.has(`${e.oracleId}|${key}`)) continue;
      seen.add(`${e.oracleId}|${key}`);
      const id = this.entries.length;
      this.entries.push(e);
      this.keys.push(key);
      const grams = trigrams(key);
      this.gramCount.push(grams.length);
      for (const g of grams) {
        const list = this.postings.get(g);
        if (list) list.push(id);
        else this.postings.set(g, [id]);
      }
    }
  }

  get size(): number {
    return this.entries.length;
  }

  /** La carta cuyo nombre más se parece a `text`, o null si nada se parece lo bastante. */
  match(text: string, minScore = 0.5): NameMatch | null {
    const q = scanKey(text);
    if (q.length < 3) return null;
    const grams = trigrams(q);
    // Contadores en un array reutilizado (mucho más rápido que un Map con ~35 000 nombres).
    if (this.counts.length < this.entries.length)
      this.counts = new Uint16Array(this.entries.length);
    const counts = this.counts;
    const touched: number[] = [];
    for (const g of grams) {
      for (const id of this.postings.get(g) ?? []) {
        if (counts[id] === 0) touched.push(id);
        counts[id]! += 1;
      }
    }
    // Los candidatos: los que más trigramas comparten.
    const shortlist: { id: number; dice: number }[] = [];
    for (const id of touched) {
      const dice = (2 * counts[id]!) / (grams.length + this.gramCount[id]!);
      counts[id] = 0;
      if (dice >= 0.25) shortlist.push({ id, dice });
    }
    shortlist.sort((a, b) => b.dice - a.dice);
    shortlist.length = Math.min(shortlist.length, 40);

    let best: { id: number; score: number } | null = null;
    for (const { id } of shortlist) {
      const key = this.keys[id]!;
      const whole = similarity(q, key);
      // Lo leído puede llevar algo detrás del nombre ("sol ring 1"): se compara también el
      // principio de lo leído con el nombre, con una pequeña penalización.
      const prefix = q.length > key.length ? similarity(q.slice(0, key.length), key) * 0.97 : 0;
      const score = Math.max(whole, prefix);
      const better =
        !best ||
        score > best.score + 1e-9 ||
        (Math.abs(score - best.score) <= 1e-9 &&
          (this.entries[id]!.rank ?? Infinity) < (this.entries[best.id]!.rank ?? Infinity));
      if (better) best = { id, score };
    }
    if (!best || best.score < minScore) return null;
    const e = this.entries[best.id]!;
    return { oracleId: e.oracleId, name: e.name, score: Math.round(best.score * 1000) / 1000 };
  }
}
