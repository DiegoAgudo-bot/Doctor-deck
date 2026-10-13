import { ADD_CARD_MESSAGES, addCardProblem, decklistWithCard } from "@/domain/deck/add-card";
import { chooseCommanders } from "@/domain/deck/resolve";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import { AppError, notFound } from "./errors";
import { loadDeck } from "./load-deck";
import { saveDeck } from "./save-deck";

/**
 * Añade una copia de una carta a uno de mis mazos guardados desde fuera del mazo (la colección, la
 * ficha de la carta…). Reescribe la lista en texto —aunque fuera un enlace de Moxfield o
 * Archidekt— con la carta nueva y la guarda conservando tema, candados y descartes.
 */
export async function addCardToDeck(
  deckId: string,
  oracleId: string,
  deps: { sources: readonly DeckSource[]; cards: CardRepository; decks: DeckRepository },
): Promise<{ deckId: string; deckName: string; card: string }> {
  const [saved, [card]] = await Promise.all([
    deps.decks.get(deckId),
    deps.cards.findCardsByOracleIds([oracleId]),
  ]);
  if (!saved) throw notFound("Ese mazo no existe.");
  if (!card) throw notFound("No encuentro esa carta en el catálogo.");

  const loaded = await loadDeck(saved.input, { sources: deps.sources, cards: deps.cards });
  const deck = chooseCommanders(loaded.deck, saved.commanders);
  const problem = addCardProblem(deck, card);
  if (problem) throw new AppError(problem, ADD_CARD_MESSAGES[problem](card.name), 409);

  const { id, name } = await saveDeck(
    {
      id: saved.id,
      name: saved.name,
      input: decklistWithCard(deck, card),
      theme: saved.theme ?? undefined,
      commanders: saved.commanders,
      locked: saved.locked,
      excluded: saved.excluded,
    },
    deps,
  );
  return { deckId: id, deckName: name, card: card.name };
}
