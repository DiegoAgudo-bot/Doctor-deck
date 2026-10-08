import type { Card } from "@/domain/cards/types";
import type { SkippedLine } from "@/domain/deck/decklist";
import {
  chooseCommanders,
  validateDeck,
  type DeckIssue,
  type ResolvedDeck,
} from "@/domain/deck/resolve";
import { manaCurve } from "@/domain/deck/stats";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import type { RecommendationSource } from "@/domain/ports/recommendation-source";
import type { ThemeLink } from "@/domain/recommendations/types";
import type { RoleClassifier } from "@/domain/roles/types";
import type { EngineConfig } from "@/domain/suggestions/config";
import { suggestSwaps, type SuggestionResult } from "@/domain/suggestions/engine";
import { loadDeck } from "./load-deck";
import { loadRecommendations } from "./load-recommendations";

export interface AnalyzeDeckInput {
  /** Lista de mazo (o lo que acepte alguna DeckSource). */
  input: string;
  theme?: string | undefined;
  /** oracleIds de los comandantes elegidos por el usuario (si no se detectaron). */
  commanders?: readonly string[] | undefined;
  /** oracleIds que no se deben cortar. */
  locked?: readonly string[] | undefined;
}

export interface AnalyzeDeckDeps {
  sources: readonly DeckSource[];
  cards: CardRepository;
  collection: CollectionRepository;
  recommendations: RecommendationSource;
  classifier: RoleClassifier;
  config: EngineConfig;
}

export type AnalyzeDeckResult =
  | {
      status: "needs_commander";
      deck: ResolvedDeck;
      candidates: Card[];
      skipped: SkippedLine[];
    }
  | {
      status: "ok";
      deck: ResolvedDeck;
      issues: DeckIssue[];
      skipped: SkippedLine[];
      curve: Record<number, number>;
      edhrec: {
        commanderSlug: string;
        theme: string | null;
        totalDecks: number | null;
        themes: ThemeLink[];
        fetchedAt: Date;
        stale: boolean;
        warning: string | null;
        unresolved: string[];
      };
      suggestions: SuggestionResult;
    };

/** Pipeline completo: mazo → comandante → EDHREC → colección → motor de sugerencias. */
export async function analyzeDeck(
  req: AnalyzeDeckInput,
  deps: AnalyzeDeckDeps,
): Promise<AnalyzeDeckResult> {
  const loaded = await loadDeck(req.input, { sources: deps.sources, cards: deps.cards });
  let deck = loaded.deck;
  if (req.commanders && req.commanders.length > 0) deck = chooseCommanders(deck, req.commanders);
  if (deck.commanders.length === 0) {
    return {
      status: "needs_commander",
      deck,
      candidates: deck.commanderCandidates,
      skipped: loaded.skipped,
    };
  }

  const recs = await loadRecommendations(
    { commanders: deck.commanders.map((c) => c.name), theme: req.theme },
    { source: deps.recommendations, cards: deps.cards },
  );
  const owned = await deps.collection.ownedQuantities();
  const suggestions = suggestSwaps({
    deck,
    recommendations: recs.cards,
    owned,
    locked: new Set(req.locked ?? []),
    classifier: deps.classifier,
    config: deps.config,
  });

  return {
    status: "ok",
    deck,
    issues: validateDeck(deck),
    skipped: loaded.skipped,
    curve: manaCurve([...deck.commanders.map((card) => ({ card, quantity: 1 })), ...deck.cards]),
    edhrec: {
      commanderSlug: recs.commanderSlug,
      theme: recs.theme,
      totalDecks: recs.totalDecks,
      themes: recs.themes,
      fetchedAt: recs.fetchedAt,
      stale: recs.stale,
      warning: recs.warning,
      unresolved: recs.unresolved,
    },
    suggestions,
  };
}
