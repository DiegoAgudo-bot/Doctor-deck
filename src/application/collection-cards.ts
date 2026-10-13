import { normalizeCondition } from "@/domain/cards/conditions";
import { printingPrice, type Printing } from "@/domain/cards/types";
import { NON_GAME_LAYOUTS } from "@/domain/cards/card-index";
import { normalizeLanguage } from "@/domain/cards/languages";
import { nameKey } from "@/domain/cards/names";
import {
  browseCollection,
  totals,
  type CollectionFilters,
  type CollectionSort,
  type SortDir,
} from "@/domain/collection/browse";
import type { Card } from "@/domain/cards/types";
import type { CardRepository } from "@/domain/ports/card-repository";
import type {
  CollectionEntryRow,
  CollectionRepository,
} from "@/domain/ports/collection-repository";
import { toManaboxCsv } from "@/domain/collection/manabox";
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
  /** Idioma de la copia (código de Scryfall o nombre en inglés). */
  language?: string | undefined;
  /** Estado de la copia ("near_mint", "NM", "LP"…). */
  condition?: string | undefined;
}

export interface AddCardsResult {
  added: {
    card: Card;
    quantity: number;
    foil: boolean;
    scryfallId: string | null;
    language: string | null;
    condition: string | null;
  }[];
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
      language: normalizeLanguage(item.language),
      condition: normalizeCondition(item.condition),
    });
  }
  await deps.collection.addCards(
    result.added.map((a) => ({
      oracleId: a.card.oracleId,
      name: a.card.name,
      quantity: a.quantity,
      foil: a.foil,
      scryfallId: a.scryfallId,
      language: a.language,
      condition: a.condition,
    })),
  );
  return result;
}

/**
 * Cómo se agrupa la colección: una fila por carta (todas sus copias juntas) o, como ManaBox, una
 * por variante (misma edición, foil, idioma y estado).
 */
export type CollectionGrouping = "card" | "copy";

/** Una carta de la colección con todo lo necesario para listarla y filtrarla. */
export interface CollectionCard {
  /** Identifica la fila: el oracleId o, por variante, oracleId|edición|foil|idioma|estado. */
  key: string;
  card: Card;
  /** Agrupando por variante: cuál es (null agrupando por carta). */
  variant: {
    scryfallId: string | null;
    foil: boolean;
    language: string | null;
    condition: string | null;
  } | null;
  roles: RoleSet;
  quantity: number;
  foilQuantity: number;
  /** Ediciones (códigos de set) de las copias, si se conocen. */
  sets: string[];
  /** Copias por idioma (código de Scryfall), de las que se sabe; las de más copias primero. */
  languages: { language: string; quantity: number }[];
  /** Copias que vinieron del CSV y las añadidas sueltas (con su id para poder quitarlas). */
  fromCsv: number;
  manual: {
    id: string;
    quantity: number;
    foil: boolean;
    language: string | null;
    addedAt: Date;
  }[];
  lastAdded: Date;
  /** La impresión de la que tengo más copias (la que se enseña); null si no se sabe ninguna. */
  printing: Printing | null;
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
export async function collectionView(
  deps: {
    cards: CardRepository;
    collection: CollectionRepository;
    decks: DeckRepository;
    classifier: RoleClassifier;
  },
  grouping: CollectionGrouping = "card",
): Promise<CollectionCard[]> {
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
  /** Copias por impresión de cada carta, para enseñar la que más tengo. */
  const printingCopies = new Map<string, Map<string, number>>();
  const roles = new Map<string, RoleSet>();
  for (const e of entries) {
    const card = byId.get(e.oracleId);
    if (!card) continue;
    const language0 = normalizeLanguage(e.language) ?? e.language;
    const key =
      grouping === "card"
        ? e.oracleId
        : [
            e.oracleId,
            e.scryfallId?.toLowerCase() ?? "",
            e.foil ? "f" : "",
            language0 ?? "",
            e.condition ?? "",
          ].join("|");
    let item = out.get(key);
    if (!item) {
      const u = usage.get(e.oracleId);
      let r = roles.get(e.oracleId);
      if (!r) {
        r = deps.classifier.classify(card);
        roles.set(e.oracleId, r);
      }
      item = {
        key,
        card,
        variant:
          grouping === "card"
            ? null
            : {
                scryfallId: e.scryfallId,
                foil: e.foil,
                language: language0,
                condition: e.condition,
              },
        roles: r,
        quantity: 0,
        foilQuantity: 0,
        sets: [],
        languages: [],
        fromCsv: 0,
        manual: [],
        lastAdded: e.addedAt,
        printing: null,
        price: prices.get(e.oracleId) ?? null,
        value: null,
        usedIn: u?.decks ?? [],
        inUse: u?.quantity ?? 0,
      };
      out.set(key, item);
    }
    item.quantity += e.quantity;
    const unit = unitPrice(e);
    if (unit !== null) item.value = Math.round(((item.value ?? 0) + unit * e.quantity) * 100) / 100;
    if (e.foil) item.foilQuantity += e.quantity;
    const sid = e.scryfallId?.toLowerCase();
    if (sid && byPrinting.has(sid)) {
      const copies = printingCopies.get(key) ?? new Map<string, number>();
      copies.set(sid, (copies.get(sid) ?? 0) + e.quantity);
      printingCopies.set(key, copies);
    }
    if (e.setCode && !item.sets.includes(e.setCode.toUpperCase())) {
      item.sets.push(e.setCode.toUpperCase());
    }
    const language = normalizeLanguage(e.language) ?? e.language;
    if (language) {
      const l = item.languages.find((x) => x.language === language);
      if (l) l.quantity += e.quantity;
      else item.languages.push({ language, quantity: e.quantity });
    }
    if (e.source === "manual") {
      item.manual.push({
        id: e.id,
        quantity: e.quantity,
        foil: e.foil,
        language,
        addedAt: e.addedAt,
      });
    } else {
      item.fromCsv += e.quantity;
    }
    if (e.addedAt > item.lastAdded) item.lastAdded = e.addedAt;
  }
  for (const [key, item] of out) {
    item.languages.sort((a, b) => b.quantity - a.quantity);
    let best: [string, number] | undefined;
    for (const entry of printingCopies.get(key) ?? []) {
      if (!best || entry[1] > best[1]) best = entry;
    }
    item.printing = best ? (byPrinting.get(best[0]) ?? null) : null;
  }
  return [...out.values()];
}

export interface CollectionQuery {
  filters: CollectionFilters;
  sort: CollectionSort;
  /** Sin ella, la natural del orden (`COLLECTION_SORT_DEFAULT_DIR`). */
  dir?: SortDir | undefined;
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
  return browseCollectionView(await collectionView(deps), query);
}

/** Lo mismo sobre una vista ya calculada (p. ej. guardada en caché). */
export function browseCollectionView(
  view: readonly CollectionCard[],
  query: CollectionQuery,
): CollectionBrowseResult {
  const all = view.map((c) => ({
    ...c,
    roles: c.roles.roles,
    manualCount: c.manual.length,
    languages: c.languages.map((l) => l.language),
    lastAdded: c.lastAdded.toISOString(),
    source: c,
  }));
  const page = browseCollection(
    all,
    query.filters,
    query.sort,
    query.offset,
    query.limit,
    query.dir,
  );
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

/** Una línea de mi colección con su carta, su impresión (si se sabe) y lo que vale cada copia. */
export interface CollectionLine extends CollectionEntryRow {
  card: Card;
  printing: Printing | null;
  unitPrice: number | null;
}

/** Todas mis líneas de una carta (CSV y a mano), para verlas y editarlas una a una. */
export async function collectionLines(
  oracleId: string,
  deps: { cards: CardRepository; collection: CollectionRepository },
): Promise<CollectionLine[]> {
  const entries = (await deps.collection.entries()).filter((e) => e.oracleId === oracleId);
  const [card] = await deps.cards.findCardsByOracleIds([oracleId]);
  if (!card || entries.length === 0) return [];
  const ids = [...new Set(entries.flatMap((e) => (e.scryfallId ? [e.scryfallId] : [])))];
  const [printings, prices] = await Promise.all([
    ids.length > 0 ? deps.cards.findPrintingsByIds(ids) : Promise.resolve([]),
    deps.cards.findMinPrices([oracleId]),
  ]);
  const byId = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
  return entries
    .map((e) => {
      const printing = (e.scryfallId && byId.get(e.scryfallId.toLowerCase())) || null;
      return {
        ...e,
        card,
        printing,
        unitPrice:
          (printing ? printingPrice(printing, e.foil) : null) ?? prices.get(oracleId) ?? null,
      };
    })
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
}

export class InvalidPrintingError extends Error {
  constructor() {
    super("Esa edición no es de esta carta");
  }
}

export interface EditLineInput {
  /** 0 = quitar la línea. */
  quantity?: number | undefined;
  foil?: boolean | undefined;
  language?: string | null | undefined;
  condition?: string | null | undefined;
  /** Otra impresión de la misma carta. */
  scryfallId?: string | undefined;
}

/**
 * Edita una línea de mi colección (también las del CSV): copias, foil, idioma, estado o edición.
 * Con 0 copias se borra. Devuelve false si la línea no existe o no es mía.
 */
export async function editCollectionLine(
  lineId: string,
  input: EditLineInput,
  deps: { cards: CardRepository; collection: CollectionRepository },
): Promise<boolean> {
  if (input.quantity === 0) return deps.collection.removeLine(lineId);
  const line = (await deps.collection.entries()).find((e) => e.id === lineId);
  if (!line) return false;
  let printing: { scryfallId: string; setCode: string; collectorNumber: string } | undefined;
  if (input.scryfallId) {
    const [p] = await deps.cards.findPrintingsByIds([input.scryfallId]);
    if (!p || p.oracleId !== line.oracleId) throw new InvalidPrintingError();
    printing = {
      scryfallId: p.scryfallId.toLowerCase(),
      setCode: p.setCode,
      collectorNumber: p.collectorNumber,
    };
  }
  return deps.collection.updateLine(lineId, {
    quantity: input.quantity,
    foil: input.foil,
    language: input.language === undefined ? undefined : normalizeLanguage(input.language),
    condition: input.condition === undefined ? undefined : normalizeCondition(input.condition),
    printing,
  });
}

/** Mi colección entera en un CSV con el formato de ManaBox. */
export async function exportCollectionCsv(deps: {
  cards: CardRepository;
  collection: CollectionRepository;
}): Promise<{ csv: string; lines: number }> {
  const entries = await deps.collection.entries();
  const oracleIds = [...new Set(entries.map((e) => e.oracleId))];
  const printingIds = [...new Set(entries.flatMap((e) => (e.scryfallId ? [e.scryfallId] : [])))];
  const [cards, printings, prices] = await Promise.all([
    deps.cards.findCardsByOracleIds(oracleIds),
    printingIds.length > 0 ? deps.cards.findPrintingsByIds(printingIds) : Promise.resolve([]),
    deps.cards.findMinPrices(oracleIds),
  ]);
  const byCard = new Map(cards.map((c) => [c.oracleId, c]));
  const byPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
  const rows = [...entries]
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
    .map((e) => {
      const p = e.scryfallId ? byPrinting.get(e.scryfallId.toLowerCase()) : undefined;
      return {
        name: byCard.get(e.oracleId)?.name ?? e.name,
        setCode: p?.setCode ?? e.setCode,
        setName: p?.setName ?? null,
        collectorNumber: p?.collectorNumber ?? e.collectorNumber,
        foil: e.foil,
        quantity: e.quantity,
        scryfallId: e.scryfallId,
        condition: e.condition,
        language: e.language,
        price: (p ? printingPrice(p, e.foil) : null) ?? prices.get(e.oracleId) ?? null,
        addedAt: e.addedAt,
      };
    });
  return { csv: toManaboxCsv(rows), lines: rows.length };
}
