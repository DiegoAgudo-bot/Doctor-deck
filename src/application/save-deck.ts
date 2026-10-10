import { chooseCommanders } from "@/domain/deck/resolve";
import type { DeckVisibility } from "@/domain/deck/visibility";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import { loadDeck } from "./load-deck";

export interface SaveDeckInput {
  id?: string | undefined;
  name?: string | undefined;
  input: string;
  theme?: string | undefined;
  commanders?: readonly string[] | undefined;
  locked?: readonly string[] | undefined;
  excluded?: readonly string[] | undefined;
  /** Al crear, por defecto público; al actualizar, si no viene, no cambia. */
  visibility?: DeckVisibility | undefined;
}

export class DeckWithoutCommanderError extends Error {
  constructor() {
    super("No se puede guardar un mazo sin comandante. Elige el comandante primero.");
  }
}

/** Resuelve el mazo contra el catálogo y lo guarda (las cartas se guardan por oracleId). */
export async function saveDeck(
  req: SaveDeckInput,
  deps: { sources: readonly DeckSource[]; cards: CardRepository; decks: DeckRepository },
): Promise<{ id: string; name: string }> {
  const loaded = await loadDeck(req.input, { sources: deps.sources, cards: deps.cards });
  const deck =
    req.commanders && req.commanders.length > 0
      ? chooseCommanders(loaded.deck, req.commanders)
      : loaded.deck;
  if (deck.commanders.length === 0) throw new DeckWithoutCommanderError();

  const name =
    req.name?.trim() || loaded.deckName || deck.commanders.map((c) => c.name).join(" + ");
  const id = await deps.decks.save({
    id: req.id,
    name,
    input: req.input,
    source: loaded.source,
    theme: req.theme ?? null,
    commanders: deck.commanders.map((c) => ({ oracleId: c.oracleId, name: c.name })),
    cards: deck.cards.map((c) => ({ oracleId: c.card.oracleId, quantity: c.quantity })),
    locked: [...(req.locked ?? [])],
    excluded: [...(req.excluded ?? [])],
    visibility: req.visibility ?? (req.id === undefined ? "public" : undefined),
  });
  return { id, name };
}
