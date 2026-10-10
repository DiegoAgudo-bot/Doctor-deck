import { oneAwayCombos, type OneAwayCombo } from "@/domain/combos/analysis";
import type { Combo } from "@/domain/combos/types";
import { estimateBracket, type BracketEstimate } from "@/domain/deck/bracket";
import { chooseCommanders } from "@/domain/deck/resolve";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { ComboSource } from "@/domain/ports/combo-source";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import type { RoleClassifier } from "@/domain/roles/types";
import { loadDeck } from "./load-deck";

export interface DeckCombosResult {
  included: Combo[];
  /** A una carta: primero los que completo con mi colección. */
  oneAway: OneAwayCombo[];
  /** El bracket recalculado contando los combos completos. */
  bracket: BracketEstimate;
  fetchedAt: Date;
  stale: boolean;
  warning: string | null;
}

/**
 * Combos del mazo (Commander Spellbook): los que ya tiene, los que están a una carta y si esa
 * carta la tengo (libre o en otros mazos) o hay que comprarla. Va aparte del análisis porque
 * Spellbook tarda unos segundos la primera vez.
 */
export async function deckCombos(
  req: {
    input: string;
    commanders?: readonly string[] | undefined;
    deckId?: string | undefined;
    useOtherDecks?: boolean | undefined;
  },
  deps: {
    sources: readonly DeckSource[];
    cards: CardRepository;
    collection: CollectionRepository;
    decks: DeckRepository;
    combos: ComboSource;
    classifier: RoleClassifier;
  },
): Promise<DeckCombosResult | null> {
  const loaded = await loadDeck(req.input, { sources: deps.sources, cards: deps.cards });
  const deck =
    req.commanders && req.commanders.length > 0
      ? chooseCommanders(loaded.deck, req.commanders)
      : loaded.deck;
  if (deck.commanders.length === 0) return null;

  const found = await deps.combos.findCombos({
    commanders: deck.commanders.map((c) => c.name),
    main: deck.cards.map((c) => ({ name: c.card.name, quantity: c.quantity })),
  });
  // Los que usan cartas prohibidas no interesan.
  const almost = found.almostIncluded.filter((c) => c.bracketTag !== "B");
  const missingIds = [
    ...new Set(almost.flatMap((c) => c.cards.flatMap((x) => (x.oracleId ? [x.oracleId] : [])))),
  ];
  const [owned, usage, prices] = await Promise.all([
    deps.collection.ownedQuantities(),
    req.useOtherDecks === false ? Promise.resolve(undefined) : deps.decks.usage(req.deckId),
    deps.cards.findMinPrices(missingIds),
  ]);
  const all = [...deck.commanders, ...deck.cards.map((c) => c.card)];
  return {
    included: found.included,
    oneAway: oneAwayCombos(almost, {
      deck: new Set(all.map((c) => c.oracleId)),
      owned,
      usage,
      prices,
    }),
    bracket: estimateBracket(
      all.map((card) => ({ card, roles: deps.classifier.classify(card).roles })),
      found.included,
    ),
    fetchedAt: found.fetchedAt,
    stale: found.stale,
    warning: found.warning,
  };
}
