import type { Card } from "@/domain/cards/types";
import type { SkippedLine } from "@/domain/deck/decklist";
import {
  chooseCommanders,
  validateDeck,
  type DeckIssue,
  type ResolvedDeck,
} from "@/domain/deck/resolve";
import { estimateBracket, type Bracket, type BracketEstimate } from "@/domain/deck/bracket";
import { deckOwnership, type CardOwnership, type OwnershipTotals } from "@/domain/deck/ownership";
import { manaCurve } from "@/domain/deck/stats";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { DeckSource } from "@/domain/ports/deck-source";
import type { RecommendationSource } from "@/domain/ports/recommendation-source";
import type { ThemeLink } from "@/domain/recommendations/types";
import type { CardRoleEdit } from "@/domain/ports/role-overrides";
import {
  normalizeOverride,
  withOverrides,
  type RoleOverride,
  type RoleSource,
} from "@/domain/roles/overrides";
import { splitTags } from "@/domain/roles/tags";
import type { RoleClassifier } from "@/domain/roles/types";
import type { EngineConfig } from "@/domain/suggestions/config";
import {
  suggestPurchases,
  suggestSwaps,
  type PurchaseOptions,
  type PurchaseResult,
  type SuggestionResult,
} from "@/domain/suggestions/engine";
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
  /** oracleIds que el usuario ha descartado meter. */
  excluded?: readonly string[] | undefined;
  /** Mazo guardado que se está analizando (sus propias copias no cuentan como "usadas"). */
  deckId?: string | undefined;
  /** Descontar las copias que ya usan mis otros mazos guardados (por defecto, sí). */
  useOtherDecks?: boolean | undefined;
  /** Si viene, calcula también qué cartas comprar. */
  buy?: PurchaseOptions | undefined;
  /** Bracket al que apunta el mazo: limita lo que se propone meter. */
  targetBracket?: Bracket | undefined;
  /** Roles y etiquetas que el usuario ha corregido a mano (mandan sobre todo lo demás). */
  roleEdits?: ReadonlyMap<string, CardRoleEdit> | undefined;
}

export interface AnalyzeDeckDeps {
  sources: readonly DeckSource[];
  cards: CardRepository;
  collection: CollectionRepository;
  recommendations: RecommendationSource;
  decks: DeckRepository;
  classifier: RoleClassifier;
  config: EngineConfig;
}

export type AnalyzeDeckResult =
  | {
      status: "needs_commander";
      source: string;
      deckName: string | null;
      deck: ResolvedDeck;
      candidates: Card[];
      skipped: SkippedLine[];
    }
  | {
      status: "ok";
      source: string;
      deckName: string | null;
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
      purchases: PurchaseResult | null;
      /** Bracket estimado (mínimo) y por qué. */
      bracket: BracketEstimate;
      /**
       * Clasificador con las correcciones aplicadas (mías > etiquetas de la lista > automático) y
       * de dónde sale cada rol, y las etiquetas libres de cada carta (de la lista y mías).
       */
      roles: { classifier: RoleClassifier; sourceOf: (card: Card) => RoleSource };
      tags: Map<string, string[]>;
      /** Qué parte del mazo tengo, qué está en otros mazos y qué me falta (con su precio). */
      ownership: {
        items: CardOwnership[];
        totals: OwnershipTotals;
        /** Precio de referencia (EUR) de cada carta que hay que comprar. */
        prices: Map<string, number>;
        /** Coste aproximado de comprar lo que falta. */
        cost: number;
      };
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
      source: loaded.source,
      deckName: loaded.deckName,
      deck,
      candidates: deck.commanderCandidates,
      skipped: loaded.skipped,
    };
  }

  // Roles: mis correcciones > las etiquetas que trae la lista > los automáticos.
  const listOverrides = new Map<string, RoleOverride>();
  const tags = new Map<string, string[]>();
  for (const c of deck.cards) {
    const split = splitTags(c.tags ?? []);
    const override = normalizeOverride(split.roles);
    if (override) listOverrides.set(c.card.oracleId, override);
    if (split.free.length > 0) tags.set(c.card.oracleId, split.free);
  }
  const mine = new Map<string, RoleOverride>();
  for (const [id, edit] of req.roleEdits ?? []) {
    if (edit.override) mine.set(id, edit.override);
    if (edit.tags.length > 0) tags.set(id, [...new Set([...(tags.get(id) ?? []), ...edit.tags])]);
  }
  const classifier = withOverrides(deps.classifier, { mine, list: listOverrides });

  const recs = await loadRecommendations(
    { commanders: deck.commanders.map((c) => c.name), theme: req.theme },
    { source: deps.recommendations, cards: deps.cards },
  );
  const [owned, usage] = await Promise.all([
    deps.collection.ownedQuantities(),
    req.useOtherDecks === false ? Promise.resolve(undefined) : deps.decks.usage(req.deckId),
  ]);
  const engineInput = {
    deck,
    recommendations: recs.cards,
    owned,
    usage,
    locked: new Set(req.locked ?? []),
    excluded: new Set(req.excluded ?? []),
    classifier,
    config: deps.config,
    targetBracket: req.targetBracket,
  };
  const suggestions = suggestSwaps(engineInput);
  const own = deckOwnership(deck.commanders, deck.cards, owned, usage);
  const missing = own.items.filter((i) => i.toBuy > 0);
  const missingPrices = await deps.cards.findMinPrices(missing.map((i) => i.card.oracleId));
  const cost = missing.reduce((n, i) => n + (missingPrices.get(i.card.oracleId) ?? 0) * i.toBuy, 0);
  const purchases = req.buy
    ? suggestPurchases({
        ...engineInput,
        prices: await deps.cards.findMinPrices(recs.cards.map((r) => r.card.oracleId)),
        options: req.buy,
      })
    : null;

  return {
    status: "ok",
    source: loaded.source,
    deckName: loaded.deckName,
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
    purchases,
    bracket: estimateBracket(
      [...deck.commanders, ...deck.cards.map((c) => c.card)].map((card) => ({
        card,
        roles: classifier.classify(card).roles,
      })),
    ),
    ownership: { ...own, prices: missingPrices, cost: Math.round(cost * 100) / 100 },
    roles: { classifier, sourceOf: (card) => classifier.sourceOf(card) },
    tags,
  };
}
