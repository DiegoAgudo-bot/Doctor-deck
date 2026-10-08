import type { DeckSource } from "@/domain/ports/deck-source";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { SkippedLine } from "@/domain/deck/decklist";
import {
  resolveDecklist,
  validateDeck,
  type DeckIssue,
  type ResolvedDeck,
} from "@/domain/deck/resolve";
import { loadIndexForDecklist } from "./card-index-loader";

export class UnsupportedDeckInputError extends Error {
  constructor() {
    super("No sé leer esa entrada. Pega la lista como texto o un link de Archidekt o Moxfield.");
  }
}

export interface LoadedDeck {
  source: string;
  deckName: string | null;
  deck: ResolvedDeck;
  skipped: SkippedLine[];
  issues: DeckIssue[];
}

/** Carga un mazo desde la primera fuente que acepte la entrada y lo resuelve contra el catálogo. */
export async function loadDeck(
  input: string,
  deps: { sources: readonly DeckSource[]; cards: CardRepository },
): Promise<LoadedDeck> {
  const source = deps.sources.find((s) => s.canHandle(input));
  if (!source) throw new UnsupportedDeckInputError();
  const parsed = await source.load(input);
  const index = await loadIndexForDecklist(parsed.entries, deps.cards);
  const deck = resolveDecklist(parsed, index);
  return {
    source: source.id,
    deckName: parsed.name ?? null,
    deck,
    skipped: parsed.skipped,
    issues: validateDeck(deck),
  };
}
