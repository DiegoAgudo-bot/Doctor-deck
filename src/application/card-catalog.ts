import { canBeCommander } from "@/domain/cards/commander";
import type { CatalogQuery } from "@/domain/cards/catalog-search";
import type { Card, Printing } from "@/domain/cards/types";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { CommunityDeckRow, PublicDecks } from "@/domain/ports/social";
import type { TradeRepository } from "@/domain/ports/trades";
import type { RoleClassifier, RoleSet } from "@/domain/roles/types";
import { notFound } from "./errors";

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
