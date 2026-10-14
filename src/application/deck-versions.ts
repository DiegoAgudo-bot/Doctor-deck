import { diffVersions } from "@/domain/deck/versions";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import { withDeckLock } from "./add-card-to-deck";
import { notFound } from "./errors";
import { saveDeck } from "./save-deck";

export interface DeckVersionView {
  id: string;
  createdAt: Date;
  /** Cartas de esa versión (comandantes incluidos). */
  cardCount: number;
  /** Lo que cambió desde esa versión hasta la siguiente (o hasta ahora): nombres y copias. */
  added: { name: string; copies: number }[];
  removed: { name: string; copies: number }[];
}

/** Historial de un mazo mío: cada versión anterior con lo que cambió después. */
export async function deckVersions(
  deckId: string,
  deps: { decks: DeckRepository; cards: CardRepository },
): Promise<DeckVersionView[]> {
  const history = await deps.decks.versions(deckId);
  if (!history) throw notFound("Ese mazo no existe.");
  const ids = new Set<string>();
  const diffs = history.versions.map((v, i) => {
    const next = i === 0 ? history.current : (history.versions[i - 1]?.cards ?? []);
    const diff = diffVersions(v.cards, next);
    for (const [id] of [...diff.added, ...diff.removed]) ids.add(id);
    return diff;
  });
  const names = new Map(
    (await deps.cards.findCardsByOracleIds([...ids])).map((c) => [c.oracleId, c.name]),
  );
  const named = (rows: [string, number][]) =>
    rows.map(([id, copies]) => ({ name: names.get(id) ?? "Carta desconocida", copies }));
  return history.versions.map((v, i) => ({
    id: v.id,
    createdAt: v.createdAt,
    cardCount: v.cards.reduce((n, [, q]) => n + q, 0),
    added: named(diffs[i]?.added ?? []),
    removed: named(diffs[i]?.removed ?? []),
  }));
}

/** Vuelve a una versión anterior (la de ahora queda a su vez en el historial). */
export async function restoreDeckVersion(
  deckId: string,
  versionId: string,
  deps: { sources: readonly DeckSource[]; cards: CardRepository; decks: DeckRepository },
) {
  return withDeckLock(deckId, async () => {
    const [saved, version] = await Promise.all([
      deps.decks.get(deckId),
      deps.decks.version(deckId, versionId),
    ]);
    if (!saved || !version) throw notFound("Esa versión no existe.");
    return saveDeck(
      {
        id: saved.id,
        name: saved.name,
        input: version.input,
        theme: saved.theme ?? undefined,
        commanders: version.commanders.length > 0 ? version.commanders : saved.commanders,
        locked: saved.locked,
        excluded: saved.excluded,
      },
      deps,
    );
  });
}
