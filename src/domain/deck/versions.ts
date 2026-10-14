/** Una carta de una versión del mazo: oracleId, copias y si es comandante. */
export type VersionCard = readonly [oracleId: string, quantity: number, commander: boolean];

export interface DeckVersionInfo {
  /** Id público de la versión. */
  id: string;
  createdAt: Date;
  cards: readonly VersionCard[];
}

/** Lo que cambió de una versión a otra: cartas (por oracleId) que entraron y salieron, con copias. */
export interface VersionDiff {
  added: [oracleId: string, copies: number][];
  removed: [oracleId: string, copies: number][];
}

/** Entre dos versiones, qué entró y qué salió (contando copias, comandantes incluidos). */
export function diffVersions(
  before: readonly VersionCard[],
  after: readonly VersionCard[],
): VersionDiff {
  const count = (cards: readonly VersionCard[]) => {
    const m = new Map<string, number>();
    for (const [id, q] of cards) m.set(id, (m.get(id) ?? 0) + q);
    return m;
  };
  const a = count(before);
  const b = count(after);
  const added: VersionDiff["added"] = [];
  const removed: VersionDiff["removed"] = [];
  for (const [id, q] of b) if (q > (a.get(id) ?? 0)) added.push([id, q - (a.get(id) ?? 0)]);
  for (const [id, q] of a) if (q > (b.get(id) ?? 0)) removed.push([id, q - (b.get(id) ?? 0)]);
  return { added, removed };
}

/** Versiones que se guardan por mazo. */
export const MAX_DECK_VERSIONS = 30;
/** Cambios seguidos en menos de esto cuentan como uno (no se guarda otra versión). */
export const VERSION_COALESCE_MS = 2 * 60_000;
