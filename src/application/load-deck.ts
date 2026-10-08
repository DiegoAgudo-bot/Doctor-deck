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

export interface LoadedDeck {
  source: string;
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
  if (!source) throw new Error("No hay ninguna fuente de mazos que acepte esa entrada");
  const parsed = await source.load(input);
  const index = await loadIndexForDecklist(parsed.entries, deps.cards);
  const deck = resolveDecklist(parsed, index);
  return { source: source.id, deck, skipped: parsed.skipped, issues: validateDeck(deck) };
}
