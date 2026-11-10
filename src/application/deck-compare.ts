import type { Card } from "@/domain/cards/types";
import { diffVersions, type VersionCard } from "@/domain/deck/versions";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { AverageDeckSource } from "@/domain/ports/recommendation-source";
import { loadIndexFor } from "./card-index-loader";
import { notFound } from "./errors";

/** Con qué se compara el mazo: el mazo medio de la comunidad o una versión anterior suya. */
export type CompareTarget = { kind: "average" } | { kind: "version"; versionId: string };

export interface DeckComparison {
  /** Cartas (y copias) que lleva mi mazo ahora y lo otro no. */
  onlyMine: { card: Card; copies: number }[];
  /** Cartas que lleva lo otro y mi mazo no. */
  onlyOther: { card: Card; copies: number }[];
  /** Copias que coinciden (sin tierras básicas). */
  shared: number;
  /** Fecha de la versión con la que se compara (null con el mazo medio). */
  versionAt: Date | null;
  /** Aviso de la fuente (p. ej. datos guardados de hace tiempo). */
  warning: string | null;
}

export interface CompareDeps {
  decks: DeckRepository;
  cards: CardRepository;
  averageDecks: AverageDeckSource;
}

/**
 * Compara uno de mis mazos con una versión anterior o con el mazo medio de su comandante (y su
 * tema): qué llevo yo que lo otro no y al revés. Las tierras básicas no cuentan: su número solo
 * mete ruido.
 */
export async function compareDeck(
  deckId: string,
  target: CompareTarget,
  deps: CompareDeps,
): Promise<DeckComparison> {
  const [deck, history] = await Promise.all([deps.decks.get(deckId), deps.decks.versions(deckId)]);
  if (!deck || !history) throw notFound("Ese mazo no existe.");
  let other: VersionCard[];
  let versionAt: Date | null = null;
  let warning: string | null = null;
  if (target.kind === "version") {
    const version = history.versions.find((v) => v.id === target.versionId);
    if (!version) throw notFound("Esa versión no existe.");
    other = [...version.cards];
    versionAt = version.createdAt;
  } else {
    const average = await deps.averageDecks.getAverageDeck({
      commanders: deck.commanderNames,
      ...(deck.theme ? { theme: deck.theme } : {}),
    });
    warning = average.warning;
    const index = await loadIndexFor(
      average.cards.map((c) => ({ name: c.name, setCode: null, collectorNumber: null })),
      deps.cards,
    );
    other = [
      ...deck.commanders.map((id): VersionCard => [id, 1, true]),
      ...average.cards.flatMap((c): VersionCard[] => {
        const card = index.cardByName(c.name);
        return card ? [[card.oracleId, c.quantity, false]] : [];
      }),
    ];
  }
  const ids = [...new Set([...history.current, ...other].map(([id]) => id))];
  const basics = await deps.cards.findBasicLandIds(ids);
  const noBasics = (cards: readonly VersionCard[]) => cards.filter(([id]) => !basics.has(id));
  const mine = noBasics(history.current);
  const theirs = noBasics(other);
  // De «lo otro» a «lo mío»: lo añadido es lo que solo llevo yo.
  const diff = diffVersions(theirs, mine);
  const found = await deps.cards.findCardsByOracleIds(
    [...diff.added, ...diff.removed].map(([id]) => id),
  );
  const byId = new Map(found.map((c) => [c.oracleId, c]));
  const rows = (list: [string, number][]) =>
    list
      .flatMap(([id, copies]) => {
        const card = byId.get(id);
        return card ? [{ card, copies }] : [];
      })
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
  const total = mine.reduce((n, [, q]) => n + q, 0);
  return {
    onlyMine: rows(diff.added),
    onlyOther: rows(diff.removed),
    shared: total - diff.added.reduce((n, [, q]) => n + q, 0),
    versionAt,
    warning,
  };
}
