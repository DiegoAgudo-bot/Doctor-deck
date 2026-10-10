import { printingPrice } from "@/domain/cards/types";
import { NON_GAME_LAYOUTS } from "@/domain/cards/card-index";
import { nameKey } from "@/domain/cards/names";
import {
  browseCollection,
  totals,
  type CollectionFilters,
  type CollectionSort,
} from "@/domain/collection/browse";
import type { Card } from "@/domain/cards/types";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { RoleClassifier, RoleSet } from "@/domain/roles/types";
import { EmptyCatalogError } from "./import-collection";

/**
 * Una carta para añadir a la colección. Se identifica por `oracleId` (buscador de la web),
 * `scryfallId` (una impresión concreta: lo que dará el escáner de la app) o por nombre.
 */
export interface AddCardInput {
  oracleId?: string | undefined;
  scryfallId?: string | undefined;
  name?: string | undefined;
  quantity: number;
  foil?: boolean | undefined;
}

export interface AddCardsResult {
  added: { card: Card; quantity: number; foil: boolean; scryfallId: string | null }[];
  /** Las entradas que no corresponden a ninguna carta (su nombre o id, tal cual). */
  notFound: string[];
}

const label = (i: AddCardInput) => i.name ?? i.scryfallId ?? i.oracleId ?? "?";

/** Resuelve cada entrada contra el catálogo y añade las encontradas como cartas sueltas. */
export async function addToCollection(
  items: readonly AddCardInput[],
  deps: { cards: CardRepository; collection: CollectionRepository },
): Promise<AddCardsResult> {
  if ((await deps.cards.counts()).cards === 0) throw new EmptyCatalogError();

  const printings = await deps.cards.findPrintingsByIds(
    items.flatMap((i) => (i.scryfallId ? [i.scryfallId] : [])),
  );
  const oracleOfPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p.oracleId]));
  const byOracle = new Map(
    (
      await deps.cards.findCardsByOracleIds([
        ...items.flatMap((i) => (i.oracleId ? [i.oracleId] : [])),
        ...printings.map((p) => p.oracleId),
      ])
    ).map((c) => [c.oracleId, c]),
  );
  const keys = items.flatMap((i) =>
    i.name && !i.oracleId && !i.scryfallId ? [nameKey(i.name)] : [],
  );
  // Cartas de juego primero: un token puede llamarse igual que una carta ("Sol Ring").
  const named = (await deps.cards.findCardsByNameKeys(keys)).sort(
    (a, b) => Number(NON_GAME_LAYOUTS.has(a.layout)) - Number(NON_GAME_LAYOUTS.has(b.layout)),
  );
  // Por nombre: primero el nombre completo; si no, el de la primera cara (cartas `A // B`).
  const byName = (key: string) =>
    named.find((c) => nameKey(c.name) === key) ??
    named.find((c) => c.frontFaceName && nameKey(c.frontFaceName) === key);

  const result: AddCardsResult = { added: [], notFound: [] };
  for (const item of items) {
    const card = item.scryfallId
      ? byOracle.get(oracleOfPrinting.get(item.scryfallId.toLowerCase()) ?? "")
      : item.oracleId
        ? byOracle.get(item.oracleId)
        : item.name
          ? byName(nameKey(item.name))
          : undefined;
    if (!card) {
      result.notFound.push(label(item));
      continue;
    }
    result.added.push({
      card,
      quantity: item.quantity,
      foil: item.foil ?? false,
      scryfallId: item.scryfallId?.toLowerCase() ?? null,
    });
  }
  await deps.collection.addCards(
    result.added.map((a) => ({
      oracleId: a.card.oracleId,
      name: a.card.name,
      quantity: a.quantity,
      foil: a.foil,
      scryfallId: a.scryfallId,
    })),
  );
  return result;
}

/** Una carta de la colección con todo lo necesario para listarla y filtrarla. */
export interface CollectionCard {
  card: Card;
  roles: RoleSet;
  quantity: number;
  foilQuantity: number;
  /** Ediciones (códigos de set) de las copias, si se conocen. */
  sets: string[];
  /** Copias que vinieron del CSV y las añadidas sueltas (con su id para poder quitarlas). */
  fromCsv: number;
  manual: { id: string; quantity: number; foil: boolean; addedAt: Date }[];
  lastAdded: Date;
  /** Precio de referencia (EUR) de la impresión más barata; null si no hay. */
  price: number | null;
  /**
   * Lo que valen mis copias: cada una al precio de su impresión (normal o foil); si no se sabe la
   * impresión o no tiene precio, al de referencia. null si no hay ningún precio.
   */
  value: number | null;
  /** Mazos guardados que la usan y cuántas copias. */
  usedIn: string[];
  inUse: number;
}

/** La colección agrupada por carta (oracleId), con datos del catálogo, precio, roles y mazos. */
export async function collectionView(deps: {
  cards: CardRepository;
  collection: CollectionRepository;
  decks: DeckRepository;
  classifier: RoleClassifier;
}): Promise<CollectionCard[]> {
  const entries = await deps.collection.entries();
  const ids = [...new Set(entries.map((e) => e.oracleId))];
  const printingIds = [...new Set(entries.flatMap((e) => (e.scryfallId ? [e.scryfallId] : [])))];
  const [cards, prices, usage, printings] = await Promise.all([
    deps.cards.findCardsByOracleIds(ids),
    deps.cards.findMinPrices(ids),
    deps.decks.usage(),
    printingIds.length > 0 ? deps.cards.findPrintingsByIds(printingIds) : Promise.resolve([]),
  ]);
  const byId = new Map(cards.map((c) => [c.oracleId, c]));
  const byPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
  /** Precio de una copia: el de su impresión (normal o foil) o, si no, el de referencia. */
  const unitPrice = (e: (typeof entries)[number]) => {
    const p = e.scryfallId ? byPrinting.get(e.scryfallId.toLowerCase()) : undefined;
    return (p ? printingPrice(p, e.foil) : null) ?? prices.get(e.oracleId) ?? null;
  };

  const out = new Map<string, CollectionCard>();
  for (const e of entries) {
    const card = byId.get(e.oracleId);
    if (!card) continue;
    let item = out.get(e.oracleId);
    if (!item) {
      const u = usage.get(e.oracleId);
      item = {
        card,
        roles: deps.classifier.classify(card),
        quantity: 0,
        foilQuantity: 0,
        sets: [],
        fromCsv: 0,
        manual: [],
        lastAdded: e.addedAt,
        price: prices.get(e.oracleId) ?? null,
        value: null,
        usedIn: u?.decks ?? [],
        inUse: u?.quantity ?? 0,
      };
      out.set(e.oracleId, item);
    }
    item.quantity += e.quantity;
    const unit = unitPrice(e);
    if (unit !== null) item.value = Math.round(((item.value ?? 0) + unit * e.quantity) * 100) / 100;
    if (e.foil) item.foilQuantity += e.quantity;
    if (e.setCode && !item.sets.includes(e.setCode.toUpperCase())) {
      item.sets.push(e.setCode.toUpperCase());
    }
    if (e.source === "manual") {
      item.manual.push({ id: e.id, quantity: e.quantity, foil: e.foil, addedAt: e.addedAt });
    } else {
      item.fromCsv += e.quantity;
    }
    if (e.addedAt > item.lastAdded) item.lastAdded = e.addedAt;
  }
  return [...out.values()];
}

export interface CollectionQuery {
  filters: CollectionFilters;
  sort: CollectionSort;
  offset: number;
  limit: number;
}

export interface CollectionBrowseResult {
  items: CollectionCard[];
  /** Lo que cumple los filtros. */
  total: ReturnType<typeof totals>;
  /** Toda la colección, sin filtros. */
  overall: ReturnType<typeof totals>;
}

/**
 * Una página de la colección: filtra y ordena en el servidor y devuelve solo `limit` cartas (la
 * colección entera puede ser de miles y pesar megas), con los totales de lo filtrado y de todo.
 */
export async function browseMyCollection(
  query: CollectionQuery,
  deps: Parameters<typeof collectionView>[0],
): Promise<CollectionBrowseResult> {
  const all = (await collectionView(deps)).map((c) => ({
    ...c,
    roles: c.roles.roles,
    manualCount: c.manual.length,
    lastAdded: c.lastAdded.toISOString(),
    source: c,
  }));
  const page = browseCollection(all, query.filters, query.sort, query.offset, query.limit);
  return {
    items: page.items.map((i) => i.source),
    total: page.total,
    overall: totals(all),
  };
}

/** Las cartas añadidas a mano, de la más reciente a la más antigua, con su carta. */
export async function addedCards(deps: {
  cards: CardRepository;
  collection: CollectionRepository;
}) {
  const manual = (await deps.collection.entries()).filter((e) => e.source === "manual");
  const cards = new Map(
    (await deps.cards.findCardsByOracleIds([...new Set(manual.map((m) => m.oracleId))])).map(
      (c) => [c.oracleId, c],
    ),
  );
  return manual.flatMap((m) => {
    const card = cards.get(m.oracleId);
    return card ? [{ ...m, card }] : [];
  });
}
