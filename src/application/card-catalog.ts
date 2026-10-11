import { canBeCommander } from "@/domain/cards/commander";
import type { CatalogQuery } from "@/domain/cards/catalog-search";
import type { Card, Printing } from "@/domain/cards/types";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { CommunityDeckRow, PublicDecks } from "@/domain/ports/social";
import type { TradeRepository } from "@/domain/ports/trades";
import type { RoleClassifier, RoleSet } from "@/domain/roles/types";
import type { RecommendationSource } from "@/domain/ports/recommendation-source";
import { recommendationSections } from "@/domain/recommendations/sections";
import { AppError, notFound } from "./errors";
import { loadRecommendations } from "./load-recommendations";

export const CATALOG_PAGE = 36;

/** Una página del buscador de cartas, con el precio más barato de cada una. */
export async function browseCatalog(
  query: CatalogQuery,
  offset: number,
  limit: number,
  deps: { cards: CardRepository },
) {
  const { cards, total } = await deps.cards.searchCatalog(query, offset, limit);
  const prices = await deps.cards.findMinPrices(cards.map((c) => c.oracleId));
  return { cards, total, prices };
}

export interface MyCopies {
  owned: number;
  /** Ni en mis mazos ni prestadas. */
  free: number;
  /** Mis mazos que la usan (y "Prestada a…"). */
  usedIn: string[];
  /** Copias en mi lista de deseos (añadidas a mano). */
  wished: number;
}

export interface CardDetail {
  card: Card;
  roles: RoleSet;
  commander: boolean;
  printings: Printing[];
  /** Precio más barato y el más barato en foil, entre todas las impresiones. */
  minPrice: number | null;
  minFoilPrice: number | null;
  /** Solo con sesión. */
  mine: MyCopies | null;
  /** Mazos públicos con esta carta de comandante (los más recientes). */
  commanderDecks: CommunityDeckRow[];
}

const min = (xs: (number | null | undefined)[]) => {
  const ok = xs.filter((x): x is number => typeof x === "number");
  return ok.length ? Math.min(...ok) : null;
};

/** Ficha de una carta: datos, roles, impresiones con precio, mis copias y mazos que la lideran. */
export async function cardDetail(
  oracleId: string,
  viewerId: string | null,
  deps: {
    cards: CardRepository;
    classifier: RoleClassifier;
    publicDecks: PublicDecks;
    collectionFor: (userId: string) => CollectionRepository;
    decksFor: (userId: string) => DeckRepository;
    tradesFor: (userId: string) => TradeRepository;
  },
): Promise<CardDetail> {
  const [card] = await deps.cards.findCardsByOracleIds([oracleId]);
  if (!card) throw notFound("Esa carta no existe.");
  const commander = canBeCommander(card) && card.legalCommander;
  const [printings, mine, commanderDecks] = await Promise.all([
    deps.cards.findPrintingsOf(card.oracleId),
    viewerId ? myCopies(card.oracleId, viewerId, deps) : Promise.resolve(null),
    commander
      ? deps.publicDecks
          .search({ q: card.frontFaceName ?? card.name }, 60)
          .then((rows) => rows.filter((d) => d.commanders.includes(card.oracleId)).slice(0, 6))
      : Promise.resolve([]),
  ]);
  return {
    card,
    roles: deps.classifier.classify(card),
    commander,
    printings,
    minPrice: min(printings.map((p) => p.priceEur)),
    minFoilPrice: min(printings.map((p) => p.priceEurFoil)),
    mine,
    commanderDecks,
  };
}

async function myCopies(
  oracleId: string,
  userId: string,
  deps: {
    collectionFor: (userId: string) => CollectionRepository;
    decksFor: (userId: string) => DeckRepository;
    tradesFor: (userId: string) => TradeRepository;
  },
): Promise<MyCopies> {
  const [owned, usage, wishes] = await Promise.all([
    deps.collectionFor(userId).ownedQuantities(),
    deps.decksFor(userId).usage(),
    deps.tradesFor(userId).wishes(),
  ]);
  const n = owned.get(oracleId) ?? 0;
  const u = usage.get(oracleId);
  return {
    owned: n,
    free: Math.max(0, n - (u?.quantity ?? 0)),
    usedIn: u?.decks ?? [],
    wished: wishes.find((w) => w.oracleId === oracleId)?.quantity ?? 0,
  };
}

/** Como mucho tantas cartas por lista (EDHREC da muchas más en "Criaturas" o "Tierras"). */
export const STAPLES_PER_SECTION = 30;

/**
 * Lo que se juega con un comandante en EDHREC (general o de un tema), por listas como en su web:
 * alta sinergia, las más jugadas, criaturas, instantáneos, conjuros… con el precio de cada carta y,
 * con sesión, cuántas tengo libres. Si EDHREC falla se propaga su error (con aviso al usuario).
 */
export async function commanderStaples(
  oracleId: string,
  theme: string | null,
  viewerId: string | null,
  deps: {
    cards: CardRepository;
    recommendations: RecommendationSource;
    collectionFor: (userId: string) => CollectionRepository;
    decksFor: (userId: string) => DeckRepository;
  },
) {
  const [card] = await deps.cards.findCardsByOracleIds([oracleId]);
  if (!card) throw notFound("Esa carta no existe.");
  if (!canBeCommander(card)) {
    throw new AppError("not_commander", "Esa carta no puede ser comandante.");
  }
  const recs = await loadRecommendations(
    { commanders: [card.name], ...(theme ? { theme } : {}) },
    { source: deps.recommendations, cards: deps.cards },
  );
  const sections = recommendationSections(
    recs.cards.filter((r) => r.card.oracleId !== card.oracleId),
  ).map((s) => ({ ...s, cards: s.cards.slice(0, STAPLES_PER_SECTION) }));
  const ids = [...new Set(sections.flatMap((s) => s.cards.map((c) => c.card.oracleId)))];
  const [prices, owned, usage] = await Promise.all([
    deps.cards.findMinPrices(ids),
    viewerId ? deps.collectionFor(viewerId).ownedQuantities() : Promise.resolve(null),
    viewerId ? deps.decksFor(viewerId).usage() : Promise.resolve(null),
  ]);
  const mine = owned
    ? new Map(
        ids.flatMap((id) => {
          const n = owned.get(id) ?? 0;
          return n
            ? [[id, { owned: n, free: Math.max(0, n - (usage?.get(id)?.quantity ?? 0)) }] as const]
            : [];
        }),
      )
    : null;
  return {
    commander: card,
    theme: recs.theme,
    themes: recs.themes,
    totalDecks: recs.totalDecks,
    slug: recs.commanderSlug,
    sections,
    prices,
    mine,
    warning: recs.warning,
  };
}
