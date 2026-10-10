import { localImageUrl } from "@/domain/cards/images";
import type { DeckOwnershipSummary } from "@/domain/community/rank";
import type { BracketEstimate } from "@/domain/deck/bracket";
import type { PriceChange, PricePoint } from "@/domain/prices/history";
import type { RoleSource } from "@/domain/roles/overrides";
import type { AnalyzeDeckResult } from "@/application/analyze-deck";
import type { AddCardsResult, CollectionCard } from "@/application/collection-cards";
import type { CollectionImportSummary } from "@/application/import-collection";
import type { Card, Color } from "@/domain/cards/types";
import type { SkippedLine } from "@/domain/deck/decklist";
import type { DeckIssue } from "@/domain/deck/resolve";
import type { CollectionSummary } from "@/domain/ports/collection-repository";
import type { ThemeLink } from "@/domain/recommendations/types";
import { ROLE_LABELS, type Role } from "@/domain/roles/types";
import type { EngineConfig } from "@/domain/suggestions/config";
import type {
  AddCandidate,
  CardProblem,
  PurchaseCandidate,
  PurchaseResult,
  PurchaseSuggestion,
  ScoredCard,
  SwapSuggestion,
} from "@/domain/suggestions/engine";
import type { SavedDeck, SavedDeckSummary } from "@/domain/ports/deck-repository";

/*
 * Formas JSON de la API (/api/*). Las consumen la UI web y, en el futuro, la app móvil.
 * Los componentes de cliente solo importan los tipos (`import type`).
 */

export interface CardDTO {
  oracleId: string;
  name: string;
  imageUrl: string | null;
  typeLine: string;
  manaCost: string | null;
  cmc: number;
  colorIdentity: Color[];
  /** `layout` de Scryfall (normal, split, transform, modal_dfc…). */
  layout: string;
  /** En la lista de game changers de los brackets. */
  gameChanger: boolean;
}

export interface ScoredCardDTO {
  card: CardDTO;
  roles: Role[];
  primaryRole: Role;
  synergy: number | null;
  inclusion: number | null;
  inEdhrec: boolean;
  problem: CardProblem | null;
  owned?: number;
  /** Copias libres (descontando otros mazos). */
  available?: number;
  /** Otros mazos guardados donde ya está. */
  usedIn?: string[];
  /** Precio de referencia en EUR (modo compra). */
  price?: number;
}

export interface SwapDTO {
  id: string;
  out: ScoredCardDTO;
  in: ScoredCardDTO;
  score: number;
  sameRole: boolean;
  fillsDeficit: Role[];
  reason: string;
}

export interface DeckCardDTO {
  card: CardDTO;
  quantity: number;
  roles: Role[];
  primaryRole: Role;
  /** De dónde salen los roles: automáticos, etiquetas de la lista o corregidos por mí. */
  roleSource: RoleSource;
  /** Etiquetas libres (de la lista y mías). */
  tags: string[];
  isBasicLand: boolean;
}

/** Una carta del mazo frente a mi colección. */
export interface OwnershipItemDTO {
  card: CardDTO;
  isCommander: boolean;
  needed: number;
  owned: number;
  available: number;
  usedIn: string[];
  fromOtherDecks: number;
  toBuy: number;
  status: "owned" | "in_other_decks" | "missing" | "basic";
  /** Precio de referencia (EUR) si hay que comprarla. */
  price: number | null;
}

export interface OwnershipDTO {
  items: OwnershipItemDTO[];
  totals: { cards: number; have: number; fromOtherDecks: number; toBuy: number; cost: number };
}

export interface IssueDTO {
  kind: DeckIssue["kind"];
  message: string;
}

export interface RoleStatDTO {
  role: Role;
  label: string;
  count: number;
  min: number;
}

export type AnalyzeResponse =
  | {
      status: "needs_commander";
      source: string;
      deckName: string | null;
      candidates: CardDTO[];
      skipped: SkippedLine[];
      unresolved: string[];
    }
  | {
      status: "ok";
      /** "text" | "archidekt" | "moxfield" */
      source: string;
      deckName: string | null;
      commanders: CardDTO[];
      cards: DeckCardDTO[];
      totalCards: number;
      issues: IssueDTO[];
      skipped: SkippedLine[];
      unresolved: string[];
      curve: Record<number, number>;
      roles: RoleStatDTO[];
      edhrec: {
        commanderSlug: string;
        theme: string | null;
        totalDecks: number | null;
        themes: ThemeLink[];
        fetchedAt: string;
        stale: boolean;
        warning: string | null;
        unresolved: string[];
      };
      swaps: SwapDTO[];
      addCandidates: ScoredCardDTO[];
      /** Recomendadas que tengo pero con todas las copias en otros mazos. */
      unavailableCandidates: ScoredCardDTO[];
      purchases: PurchasesDTO | null;
      cutCandidates: ScoredCardDTO[];
      ownership: OwnershipDTO;
      /** Bracket estimado (el mínimo en el que encaja) y por qué. */
      bracket: BracketEstimate;
    };

export interface PurchasesDTO {
  items: SwapDTO[];
  totalCost: number;
  /** Nº de cartas comprables que cumplían los filtros. */
  candidateCount: number;
}

export interface SavedDeckSummaryDTO extends Omit<SavedDeckSummary, "updatedAt"> {
  updatedAt: string;
  /** Primer comandante (imagen) e identidad de color del mazo, para las listas. */
  commanderCard: CardDTO | null;
  colorIdentity: Color[];
}

export interface SavedDeckDTO extends Omit<SavedDeck, "updatedAt"> {
  updatedAt: string;
}

/** Un mazo abierto por su enlace: tuyo o, si es público, de otro. */
export interface DeckViewDTO extends SavedDeckDTO {
  isMine: boolean;
  owner: { username: string | null; name: string };
  likes: number;
  liked: boolean;
}

/** Lo público de un usuario (nunca el email). */
export interface PublicProfileDTO {
  username: string;
  name: string;
  image: string | null;
  collectionPublic: boolean;
  createdAt: string;
}

export interface ProfileViewDTO {
  profile: PublicProfileDTO;
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  decks: SavedDeckSummaryDTO[];
}

export interface UserSummaryDTO extends PublicProfileDTO {
  followers: number;
  publicDecks: number;
}

export interface NotificationDTO {
  id: string;
  type: "new_deck" | "big_card" | "price_drop";
  actor: { username: string | null; name: string };
  deckId: string | null;
  cardId: string | null;
  title: string;
  price: number | null;
  /** price_drop: el precio de referencia (máximo de los 30 días anteriores). */
  prevPrice: number | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse {
  items: NotificationDTO[];
  unread: number;
}

/** Mi perfil (ajustes). */
export interface MyProfileDTO extends PublicProfileDTO {
  email: string;
  /** Avisar si algo que me falta baja este % (null = no avisar). */
  priceAlertPercent: number | null;
}

/** Corrección de roles de una carta (roles vacíos = los automáticos). */
export interface CardRoleEditDTO {
  roles: Role[];
  primary: Role | null;
  tags: string[];
}

export interface CardPricesDTO {
  /** Precio de cada día guardado (la impresión más barata), del más antiguo al más reciente. */
  history: PricePoint[];
  change: PriceChange | null;
}

export interface PriceMoverDTO extends PriceChange {
  card: CardDTO;
  copies: number;
  before: number;
  delta: number;
  /** Lo que ha cambiado el valor de mis copias. */
  valueDelta: number;
}

export interface CollectionPricesDTO {
  /** Desde qué día y hasta qué día hay datos (null si aún no hay ninguno). */
  since: string | null;
  latest: string | null;
  value: PricePoint[];
  up: PriceMoverDTO[];
  down: PriceMoverDTO[];
}

export interface CommunityDeckDTO extends SavedDeckSummaryDTO {
  owner: { username: string | null; name: string };
  likes: number;
  /** ¿Le he dado "me gusta"? */
  liked: boolean;
  bracket: number | null;
  /** Cuánto del mazo tengo yo y cuánto cuesta lo que falta. */
  ownership: DeckOwnershipSummary;
}

export interface CommunityResponse {
  items: CommunityDeckDTO[];
  /** Mazos que cumplen los filtros (como mucho los últimos 500). */
  total: number;
}

/** Para el asistente de "Nuevo mazo": el comandante, sus temas en EDHREC y el nombre propuesto. */
export interface CommanderInfoDTO {
  commanders: CardDTO[];
  themes: ThemeLink[];
  totalDecks: number | null;
  suggestedName: string;
  warning: string | null;
}

export interface NewDeckResponse {
  /** Con sesión se guarda (id); sin ella hay que abrir `input` en /mazo. */
  saved: boolean;
  id: string | null;
  name: string;
  input: string;
  theme: string | null;
  warning: string | null;
}

export interface StatusResponse {
  catalog: { cards: number; printings: number };
  /** null si no hay sesión. */
  user: { id: string; name: string; email: string } | null;
  /** null si no hay sesión. */
  collection: (Omit<CollectionSummary, "importedAt"> & { importedAt: string | null }) | null;
}

export type CollectionImportResponse = Omit<CollectionImportSummary, "unmatched" | "errors"> & {
  unmatched: {
    line: number;
    name: string;
    setCode: string | null;
    collectorNumber: string | null;
  }[];
  errors: { line: number; reason: string }[];
  /** Si se ha guardado en la cuenta (con sesión). */
  saved: boolean;
  /** Sin sesión: la colección emparejada, [oracleId, copias], para guardarla en el navegador. */
  owned: [string, number][] | null;
};

/** Una carta de la colección (agrupada por oracleId) para la vista con filtros. */
export interface CollectionCardDTO {
  card: CardDTO;
  roles: Role[];
  primaryRole: Role;
  quantity: number;
  foilQuantity: number;
  sets: string[];
  fromCsv: number;
  manual: { id: string; quantity: number; foil: boolean; addedAt: string }[];
  lastAdded: string;
  price: number | null;
  usedIn: string[];
  inUse: number;
}

/** Una página de la colección y sus totales (lo filtrado y todo). */
export interface CollectionViewResponse {
  items: CollectionCardDTO[];
  total: CollectionTotals;
  overall: CollectionTotals;
}

export interface CollectionTotals {
  cards: number;
  copies: number;
  value: number;
}

/** Una carta añadida a mano. */
export interface AddedCardDTO {
  id: string;
  card: CardDTO;
  quantity: number;
  foil: boolean;
  addedAt: string;
}

export interface AddCardsResponse {
  added: { card: CardDTO; quantity: number; foil: boolean }[];
  notFound: string[];
  /** Si se ha guardado en la cuenta (con sesión); sin ella, el navegador lo guarda. */
  saved: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------- mapeadores ----------

export const cardDTO = (c: Card): CardDTO => ({
  oracleId: c.oracleId,
  name: c.name,
  // Desde nuestro servidor (/img/…), que la guarda: no depende de que Scryfall responda.
  imageUrl: localImageUrl(c.imageUrl),
  typeLine: c.typeLine,
  manaCost: c.manaCost,
  cmc: c.cmc,
  colorIdentity: c.colorIdentity,
  layout: c.layout,
  gameChanger: c.gameChanger,
});

const scoredDTO = (s: ScoredCard | AddCandidate | PurchaseCandidate): ScoredCardDTO => ({
  card: cardDTO(s.card),
  roles: s.roles.roles,
  primaryRole: s.roles.primary,
  synergy: s.synergy,
  inclusion: s.inclusion,
  inEdhrec: s.inEdhrec,
  problem: s.problem,
  ...("available" in s ? { owned: s.owned, available: s.available, usedIn: s.usedIn } : {}),
  ...("price" in s ? { price: s.price, owned: s.owned, usedIn: s.usedIn } : {}),
});

const swapDTO = (s: SwapSuggestion | PurchaseSuggestion): SwapDTO => ({
  id: `${s.out.card.oracleId}>${s.in.card.oracleId}`,
  out: scoredDTO(s.out),
  in: scoredDTO(s.in),
  score: s.score,
  sameRole: s.sameRole,
  fillsDeficit: s.fillsDeficit,
  reason: s.reason,
});

export function issueMessage(i: DeckIssue): string {
  switch (i.kind) {
    case "size":
      return `El mazo tiene ${i.count} cartas (deberían ser 100).`;
    case "noCommander":
      return "No hay comandante.";
    case "duplicate":
      return `${i.card.name} aparece ${i.quantity} veces (Commander es singleton).`;
    case "colorIdentity":
      return `${i.card.name} está fuera de la identidad de color del comandante.`;
    case "notLegal":
      return `${i.card.name} no es legal en Commander.`;
  }
}

export function analyzeResponse(result: AnalyzeDeckResult, config: EngineConfig): AnalyzeResponse {
  const unresolved = result.deck.unresolved.map((e) => e.name);
  if (result.status === "needs_commander") {
    return {
      status: "needs_commander",
      source: result.source,
      deckName: result.deckName,
      candidates: result.candidates.map(cardDTO),
      skipped: result.skipped,
      unresolved,
    };
  }
  const { deck, suggestions: s } = result;
  return {
    status: "ok",
    source: result.source,
    deckName: result.deckName,
    commanders: deck.commanders.map(cardDTO),
    cards: deck.cards.map(({ card, quantity }) => {
      const roles = result.roles.classifier.classify(card);
      return {
        card: cardDTO(card),
        quantity,
        roles: roles.roles,
        primaryRole: roles.primary,
        roleSource: result.roles.sourceOf(card),
        tags: result.tags.get(card.oracleId) ?? [],
        isBasicLand: card.isBasicLand,
      };
    }),
    totalCards: deck.commanders.length + deck.cards.reduce((n, c) => n + c.quantity, 0),
    issues: result.issues.map((i) => ({ kind: i.kind, message: issueMessage(i) })),
    skipped: result.skipped,
    unresolved,
    curve: result.curve,
    roles: (Object.keys(s.roleCounts) as Role[]).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      count: s.roleCounts[role],
      min: config.minimums[role] ?? 0,
    })),
    edhrec: { ...result.edhrec, fetchedAt: result.edhrec.fetchedAt.toISOString() },
    swaps: s.swaps.map(swapDTO),
    addCandidates: s.addCandidates.slice(0, 40).map(scoredDTO),
    unavailableCandidates: s.unavailableCandidates.slice(0, 40).map(scoredDTO),
    purchases: result.purchases ? purchasesDTO(result.purchases) : null,
    cutCandidates: s.cutCandidates.slice(0, 40).map(scoredDTO),
    bracket: result.bracket,
    ownership: {
      items: result.ownership.items.map((i) => ({
        card: cardDTO(i.card),
        isCommander: i.isCommander,
        needed: i.needed,
        owned: i.owned,
        available: i.available,
        usedIn: i.usedIn,
        fromOtherDecks: i.fromOtherDecks,
        toBuy: i.toBuy,
        status: i.status,
        price: result.ownership.prices.get(i.card.oracleId) ?? null,
      })),
      totals: { ...result.ownership.totals, cost: result.ownership.cost },
    },
  };
}

export function collectionImportResponse(
  s: CollectionImportSummary,
  owned: [string, number][] | null = null,
): CollectionImportResponse {
  return {
    saved: owned === null,
    owned,
    ...s,
    unmatched: s.unmatched.map((r) => ({
      line: r.line,
      name: r.name,
      setCode: r.setCode,
      collectorNumber: r.collectorNumber,
    })),
    errors: s.errors.map((e) => ({ line: e.line, reason: e.reason })),
  };
}

function purchasesDTO(p: PurchaseResult): PurchasesDTO {
  return {
    items: p.purchases.map(swapDTO),
    totalCost: p.totalCost,
    candidateCount: p.candidates.length,
  };
}

const WUBRG: Color[] = ["W", "U", "B", "R", "G"];

/** `cards`: los comandantes de los mazos (los que no estén se ignoran). */
export function savedDeckSummaryDTO(
  d: SavedDeckSummary,
  cards: ReadonlyMap<string, Card> = new Map(),
): SavedDeckSummaryDTO {
  const commanders = d.commanders.flatMap((id) => cards.get(id) ?? []);
  const identity = new Set(commanders.flatMap((c) => c.colorIdentity));
  return {
    ...d,
    updatedAt: d.updatedAt.toISOString(),
    commanderCard: commanders[0] ? cardDTO(commanders[0]) : null,
    colorIdentity: WUBRG.filter((c) => identity.has(c)),
  };
}

export const savedDeckDTO = (d: SavedDeck): SavedDeckDTO => ({
  ...d,
  updatedAt: d.updatedAt.toISOString(),
});

export const collectionCardDTO = (c: CollectionCard): CollectionCardDTO => ({
  card: cardDTO(c.card),
  roles: c.roles.roles,
  primaryRole: c.roles.primary,
  quantity: c.quantity,
  foilQuantity: c.foilQuantity,
  sets: c.sets,
  fromCsv: c.fromCsv,
  manual: c.manual.map((m) => ({ ...m, addedAt: m.addedAt.toISOString() })),
  lastAdded: c.lastAdded.toISOString(),
  price: c.price,
  usedIn: c.usedIn,
  inUse: c.inUse,
});

export const addCardsResponse = (r: AddCardsResult, saved: boolean): AddCardsResponse => ({
  added: r.added.map((a) => ({ card: cardDTO(a.card), quantity: a.quantity, foil: a.foil })),
  notFound: r.notFound,
  saved,
});

export const publicProfileDTO = (p: {
  username: string | null;
  name: string;
  image: string | null;
  collectionPublic: boolean;
  createdAt: Date;
}): PublicProfileDTO => ({
  username: p.username ?? "",
  name: p.name,
  image: p.image,
  collectionPublic: p.collectionPublic,
  createdAt: p.createdAt.toISOString(),
});
