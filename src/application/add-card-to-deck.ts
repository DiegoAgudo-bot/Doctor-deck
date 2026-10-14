import {
  ADD_CARD_MESSAGES,
  addCardProblem,
  cardChangesProblem,
  decklistWithChanges,
  type DeckCardChange,
} from "@/domain/deck/add-card";
import { chooseCommanders } from "@/domain/deck/resolve";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import { AppError, notFound } from "./errors";
import { loadDeck } from "./load-deck";
import { saveDeck } from "./save-deck";

type Deps = { sources: readonly DeckSource[]; cards: CardRepository; decks: DeckRepository };

const deckLocks = new Map<string, Promise<unknown>>();

/**
 * Los cambios a un mismo mazo, de uno en uno: cada uno lee la lista guardada, la cambia y la
 * guarda; si dos se cruzan (dos toques seguidos, la app y la web), el segundo parte del primero
 * en vez de pisarlo.
 */
export async function withDeckLock<T>(deckId: string, fn: () => Promise<T>): Promise<T> {
  const run = (deckLocks.get(deckId) ?? Promise.resolve()).catch(() => undefined).then(fn);
  deckLocks.set(deckId, run);
  try {
    return await run;
  } finally {
    if (deckLocks.get(deckId) === run) deckLocks.delete(deckId);
  }
}

/**
 * Cambia copias de cartas de uno de mis mazos guardados sin pasar por el analizador (la app:
 * aplicar un cambio «quita X → mete Y», quitar una carta…). Reescribe la lista en texto —aunque
 * fuera un enlace de Moxfield o Archidekt— y la guarda conservando tema, candados y descartes.
 * `check` decide si se puede (por defecto, `cardChangesProblem`).
 */
export async function changeDeckCards(
  deckId: string,
  changes: readonly { oracleId: string; delta: number }[],
  deps: Deps,
  check = cardChangesProblem,
): Promise<{ deckId: string; deckName: string; cards: string[] }> {
  return withDeckLock(deckId, () => changeUnlocked(deckId, changes, deps, check));
}

async function changeUnlocked(
  deckId: string,
  changes: readonly { oracleId: string; delta: number }[],
  deps: Deps,
  check: typeof cardChangesProblem,
): Promise<{ deckId: string; deckName: string; cards: string[] }> {
  const ids = [...new Set(changes.map((c) => c.oracleId))];
  const [saved, found] = await Promise.all([
    deps.decks.get(deckId),
    deps.cards.findCardsByOracleIds(ids),
  ]);
  if (!saved) throw notFound("Ese mazo no existe.");
  const byId = new Map(found.map((c) => [c.oracleId, c]));
  const resolved: DeckCardChange[] = changes
    .filter((c) => c.delta !== 0)
    .map((c) => {
      const card = byId.get(c.oracleId);
      if (!card) throw notFound("No encuentro esa carta en el catálogo.");
      return { card, delta: c.delta };
    });

  const loaded = await loadDeck(saved.input, { sources: deps.sources, cards: deps.cards });
  const deck = chooseCommanders(loaded.deck, saved.commanders);
  const failed = check(deck, resolved);
  if (failed) {
    throw new AppError(failed.problem, ADD_CARD_MESSAGES[failed.problem](failed.card.name), 409);
  }

  const { id, name } = await saveDeck(
    {
      id: saved.id,
      name: saved.name,
      input: decklistWithChanges(deck, resolved),
      theme: saved.theme ?? undefined,
      commanders: saved.commanders,
      locked: saved.locked,
      excluded: saved.excluded,
    },
    deps,
  );
  return { deckId: id, deckName: name, cards: resolved.map((c) => c.card.name) };
}

/**
 * Añade una copia de una carta a uno de mis mazos guardados desde fuera del mazo (la colección, la
 * ficha de la carta…): no puede ser el comandante, tiene que estar en su identidad y no estar ya
 * (salvo básicas).
 */
export async function addCardToDeck(
  deckId: string,
  oracleId: string,
  deps: Deps,
): Promise<{ deckId: string; deckName: string; card: string }> {
  const res = await changeDeckCards(deckId, [{ oracleId, delta: 1 }], deps, (deck, [change]) => {
    const problem = change ? addCardProblem(deck, change.card) : null;
    return problem && change ? { problem, card: change.card } : null;
  });
  return { deckId: res.deckId, deckName: res.deckName, card: res.cards[0] ?? "" };
}

/**
 * «Descartar» un cambio sugerido: esa carta no se vuelve a proponer en este mazo. Se añade a los
 * descartes de la versión guardada (no a la que tenga el cliente, que puede ser vieja).
 */
export async function excludeFromDeck(deckId: string, oracleId: string, deps: Deps) {
  return withDeckLock(deckId, async () => {
    const saved = await deps.decks.get(deckId);
    if (!saved) throw notFound("Ese mazo no existe.");
    if (saved.excluded.includes(oracleId)) return;
    await saveDeck(
      {
        id: saved.id,
        name: saved.name,
        input: saved.input,
        theme: saved.theme ?? undefined,
        commanders: saved.commanders,
        locked: saved.locked,
        excluded: [...saved.excluded, oracleId],
      },
      deps,
    );
  });
}
