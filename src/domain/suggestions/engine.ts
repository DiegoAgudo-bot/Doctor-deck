import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card } from "../cards/types";
import {
  allowsMassLandDenial,
  GAME_CHANGER_LIMIT,
  isMassLandDenial,
  type Bracket,
} from "../deck/bracket";
import type { ResolvedDeck } from "../deck/resolve";
import type { ResolvedRecommendation } from "../recommendations/types";
import { ROLES, type Role, type RoleClassifier, type RoleSet } from "../roles/types";
import type { EngineConfig } from "./config";
import { formatEuros } from "./format";
import { swapReason } from "./reason";

/** Copias de una carta usadas en otros mazos guardados. */
export interface CardUsage {
  quantity: number;
  /** Nombres de esos mazos. */
  decks: string[];
  /** Ids (uuid) de esos mazos, en el mismo orden (si el repositorio los da). */
  deckIds?: string[] | undefined;
}

export interface EngineInput {
  deck: ResolvedDeck;
  recommendations: readonly ResolvedRecommendation[];
  /** Copias que tengo de cada carta, por oracleId. */
  owned: ReadonlyMap<string, number>;
  /** oracleIds que el usuario no quiere cortar. */
  locked: ReadonlySet<string>;
  /** oracleIds que el usuario ha descartado meter. */
  excluded?: ReadonlySet<string> | undefined;
  /** Copias ya usadas en OTROS mazos guardados (sin contar este). Si falta, todas están libres. */
  usage?: ReadonlyMap<string, CardUsage> | undefined;
  classifier: RoleClassifier;
  config: EngineConfig;
  /**
   * Bracket al que apunta el mazo: no se proponen game changers por encima de su límite ni
   * destrucción masiva de tierras por debajo del 4. Si falta, no se limita nada.
   */
  targetBracket?: Bracket | undefined;
}

/** Motivo por el que una carta del mazo debe salir sí o sí. */
export type CardProblem = "offColor" | "notLegal";

export interface ScoredCard {
  card: Card;
  /** Solo en cartas del mazo: está fuera de la identidad de color o prohibida. */
  problem: CardProblem | null;
  roles: RoleSet;
  synergy: number | null;
  inclusion: number | null;
  /** ¿Aparece en las recomendaciones de EDHREC para este comandante? */
  inEdhrec: boolean;
  /** a·synergy + b·inclusion (lo que falta cuenta como 0). */
  score: number;
}

/** Candidata a entrar sacada de mi colección. */
export interface AddCandidate extends ScoredCard {
  owned: number;
  /** Copias libres = owned − copias usadas en otros mazos. */
  available: number;
  /** Otros mazos donde ya está. */
  usedIn: string[];
}

/** Candidata a entrar comprándola. */
export interface PurchaseCandidate extends ScoredCard {
  /** Precio de referencia en EUR (la impresión más barata). */
  price: number;
  /** Copias que tengo (todas ocupadas en otros mazos si es > 0). */
  owned: number;
  usedIn: string[];
}

interface Pair<C extends ScoredCard> {
  out: ScoredCard;
  in: C;
  /** score(in) − score(out). */
  improvement: number;
  /** Bonus de rol (0..1.5) antes de multiplicar por el peso c. */
  roleBonus: number;
  /** improvement + c·roleBonus: con esto se ordenan los cambios. */
  score: number;
  sameRole: boolean;
  /** Roles bajo mínimo que cubre la carta que entra. */
  fillsDeficit: Role[];
  reason: string;
}

export type SwapSuggestion = Pair<AddCandidate>;
export type PurchaseSuggestion = Pair<PurchaseCandidate>;

export interface RoleDeficit {
  role: Role;
  count: number;
  min: number;
}

export interface SuggestionResult {
  /** Cartas por rol (una carta cuenta en todos sus roles; incluye comandantes). */
  roleCounts: Record<Role, number>;
  deficits: RoleDeficit[];
  swaps: SwapSuggestion[];
  /** Cartas del mazo que se podrían cortar, de peor a mejor. */
  cutCandidates: ScoredCard[];
  /** Cartas de mi colección recomendadas, con copias libres, que no están en el mazo. */
  addCandidates: AddCandidate[];
  /** Recomendadas que tengo pero con todas las copias usadas en otros mazos. */
  unavailableCandidates: AddCandidate[];
}

export interface PurchaseOptions {
  /** Nº máximo de cartas a comprar. */
  maxCards: number;
  /** Precio máximo por carta (EUR). */
  maxPrice?: number | undefined;
  /** Presupuesto total (EUR). */
  budget?: number | undefined;
}

export interface PurchaseResult {
  purchases: PurchaseSuggestion[];
  totalCost: number;
  /** Cartas comprables que cumplen los filtros, de mejor a peor. */
  candidates: PurchaseCandidate[];
}

const emptyCounts = (): Record<Role, number> =>
  Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;

/** Lo común a cambios con colección y compras: puntuación, cortes, recuentos y filtros. */
function prepare(input: EngineInput) {
  const { deck, recommendations, locked, classifier, config } = input;
  const { weights } = config;
  const score = (syn: number | null, incl: number | null) =>
    weights.synergy * (syn ?? 0) + weights.inclusion * (incl ?? 0);

  const recByOracle = new Map(recommendations.map((r) => [r.card.oracleId, r]));
  const commanderIds = new Set(deck.commanders.map((c) => c.oracleId));
  const deckIds = new Set([...commanderIds, ...deck.cards.map((c) => c.card.oracleId)]);
  const identity = combinedColorIdentity(deck.commanders);
  const excluded = input.excluded ?? new Set<string>();
  const target = input.targetBracket;

  // Las cartas con problema puntúan por debajo de cualquier otra para que salgan primero.
  const PROBLEM_SCORE = -(Math.abs(weights.synergy) + Math.abs(weights.inclusion)) - 1;
  const problemOf = (card: Card): CardProblem | null =>
    !fitsColorIdentity(card, identity) ? "offColor" : !card.legalCommander ? "notLegal" : null;

  const scored = (card: Card, problem: CardProblem | null = null): ScoredCard => {
    const rec = recByOracle.get(card.oracleId);
    const synergy = rec?.synergy ?? null;
    const inclusion = rec?.inclusion ?? null;
    return {
      card,
      problem,
      roles: classifier.classify(card),
      synergy,
      inclusion,
      inEdhrec: !!rec,
      score: problem ? PROBLEM_SCORE : score(synergy, inclusion),
    };
  };

  // Recuento de roles del mazo actual
  const roleCounts = emptyCounts();
  for (const card of deck.commanders)
    for (const r of classifier.classify(card).roles) roleCounts[r] += 1;
  for (const { card, quantity } of deck.cards)
    for (const r of classifier.classify(card).roles) roleCounts[r] += quantity;

  // 4. Candidatos a salir: ni comandantes, ni básicas, ni bloqueadas. Primero las que están fuera
  //    de color o prohibidas; después las que no aparecen en EDHREC; después de peor a mejor score.
  const cutCandidates = deck.cards
    .filter(
      ({ card }) =>
        !commanderIds.has(card.oracleId) && !card.isBasicLand && !locked.has(card.oracleId),
    )
    .map(({ card }) => scored(card, problemOf(card)))
    .sort(
      (a, b) =>
        Number(!a.problem) - Number(!b.problem) ||
        Number(a.inEdhrec) - Number(b.inEdhrec) ||
        a.score - b.score ||
        a.card.name.localeCompare(b.card.name),
    );

  /** Recomendada que podría entrar: fuera del mazo, no descartada, legal, no básica y en identidad. */
  const canEnter = (card: Card) =>
    !deckIds.has(card.oracleId) &&
    !excluded.has(card.oracleId) &&
    card.legalCommander &&
    !card.isBasicLand &&
    // Nunca fuera de la identidad de color del comandante (sin comandante, nada que proponer).
    deck.commanders.length > 0 &&
    fitsColorIdentity(card, identity) &&
    (target === undefined || allowsMassLandDenial(target) || !isMassLandDenial(card)) &&
    (target === undefined || GAME_CHANGER_LIMIT[target] > 0 || !card.gameChanger);

  // Game changers del mazo y cuántos admite el bracket objetivo (lo controla el emparejado).
  const gameChangers = {
    count:
      deck.commanders.filter((c) => c.gameChanger).length +
      deck.cards.filter((c) => c.card.gameChanger).reduce((n, c) => n + c.quantity, 0),
    limit: target === undefined ? Infinity : GAME_CHANGER_LIMIT[target],
  };

  return { scored, roleCounts, cutCandidates, canEnter, gameChangers };
}

/** Copias libres de una carta teniendo en cuenta los otros mazos. */
function availability(input: EngineInput, oracleId: string) {
  const owned = input.owned.get(oracleId) ?? 0;
  const usage = input.usage?.get(oracleId);
  return {
    owned,
    available: Math.max(0, owned - (usage?.quantity ?? 0)),
    usedIn: usage?.decks ?? [],
  };
}

const byScore = <C extends ScoredCard>(a: C, b: C) =>
  b.score - a.score || a.card.name.localeCompare(b.card.name);

/** Motor de sugerencias: propone cambios 1×1 usando solo cartas libres de la colección. */
export function suggestSwaps(input: EngineInput): SuggestionResult {
  const { config } = input;
  const { scored, roleCounts, cutCandidates, canEnter, gameChangers } = prepare(input);

  // 3. Candidatos a entrar: recomendadas ∩ colección (con copias libres) que pueden entrar.
  const owned: AddCandidate[] = input.recommendations
    .filter((r) => (input.owned.get(r.card.oracleId) ?? 0) > 0 && canEnter(r.card))
    .map((r) => ({ ...scored(r.card), ...availability(input, r.card.oracleId) }))
    .sort(byScore);
  const addCandidates = owned.filter((c) => c.available > 0);
  const unavailableCandidates = owned.filter((c) => c.available === 0);

  const swaps = pairGreedy(cutCandidates, addCandidates, roleCounts, config, {
    maxSwaps: config.maxSuggestions,
    gameChangers,
    reason: (pair, counts) =>
      swapReason(pair, { counts, minimums: config.minimums }, ownedSentence(pair.in)),
  });

  return {
    roleCounts,
    deficits: deficitsOf(roleCounts, config),
    swaps,
    cutCandidates,
    addCandidates,
    unavailableCandidates,
  };
}

/**
 * Modo compra: "si compro N cartas baratas, ¿cuáles mejoran más el mazo?". Solo considera cartas
 * recomendadas que no tengo libres, con precio conocido y dentro de los límites de precio.
 */
export function suggestPurchases(
  input: EngineInput & {
    /** Precio de referencia (EUR) por oracleId. */
    prices: ReadonlyMap<string, number>;
    options: PurchaseOptions;
  },
): PurchaseResult {
  const { config, prices, options } = input;
  const { scored, roleCounts, cutCandidates, canEnter, gameChangers } = prepare(input);

  const candidates: PurchaseCandidate[] = input.recommendations
    .filter((r) => canEnter(r.card) && availability(input, r.card.oracleId).available === 0)
    .flatMap((r) => {
      const price = prices.get(r.card.oracleId);
      if (price === undefined || (options.maxPrice !== undefined && price > options.maxPrice)) {
        return [];
      }
      const { owned, usedIn } = availability(input, r.card.oracleId);
      return [{ ...scored(r.card), price, owned, usedIn }];
    })
    .sort(byScore);

  const purchases = pairGreedy(cutCandidates, candidates, roleCounts, config, {
    maxSwaps: Math.max(0, Math.floor(options.maxCards)),
    budget: options.budget,
    gameChangers,
    reason: (pair, counts) =>
      swapReason(pair, { counts, minimums: config.minimums }, purchaseSentence(pair.in)),
  });

  return {
    purchases,
    totalCost: Math.round(purchases.reduce((n, p) => n + p.in.price, 0) * 100) / 100,
    candidates,
  };
}

/**
 * 6. Emparejado voraz: en cada paso, el mejor par válido según los recuentos actuales. Un par es
 * válido si mejora lo suficiente, respeta los mínimos por rol y (con presupuesto) cabe en él.
 */
function pairGreedy<C extends ScoredCard & { price?: number }>(
  cutCandidates: readonly ScoredCard[],
  addCandidates: readonly C[],
  roleCounts: Record<Role, number>,
  config: EngineConfig,
  opts: {
    maxSwaps: number;
    budget?: number | undefined;
    /** Game changers en el mazo y máximo que admite el bracket objetivo. */
    gameChangers: { count: number; limit: number };
    reason: (pair: Omit<Pair<C>, "reason">, countsAfter: Record<Role, number>) => string;
  },
): Pair<C>[] {
  const counts = { ...roleCounts };
  const outs = [...cutCandidates];
  const ins = [...addCandidates];
  const result: Pair<C>[] = [];
  let remaining = opts.budget ?? Infinity;
  let gameChangers = opts.gameChangers.count;
  const gcDelta = (out: ScoredCard, inn: ScoredCard) =>
    Number(inn.card.gameChanger) - Number(out.card.gameChanger);

  while (result.length < opts.maxSwaps) {
    let best: Omit<Pair<C>, "reason"> | null = null;
    for (const out of outs) {
      for (const inn of ins) {
        if ((inn.price ?? 0) > remaining + 1e-9) continue;
        // Que entre un game changer no puede pasar el límite del bracket objetivo.
        const delta = gcDelta(out, inn);
        if (delta > 0 && gameChangers + delta > opts.gameChangers.limit) continue;
        const improvement = inn.score - out.score;
        if (improvement <= config.minImprovement) continue;
        // Una carta fuera de color o prohibida sale aunque deje un rol bajo mínimo.
        if (!out.problem && !keepsMinimums(out.roles, inn.roles, counts, config)) continue;
        const sameRole = out.roles.primary === inn.roles.primary;
        const sharesRole = out.roles.roles.some((r) => inn.roles.roles.includes(r));
        const fillsDeficit = inn.roles.roles.filter(
          (r) => counts[r] < (config.minimums[r] ?? 0) && !out.roles.roles.includes(r),
        );
        const roleBonus =
          (sameRole ? 1 : sharesRole ? 0.5 : 0) + (fillsDeficit.length > 0 ? 0.5 : 0);
        const total = improvement + config.weights.roleBonus * roleBonus;
        if (!best || total > best.score + 1e-9) {
          best = { out, in: inn, improvement, roleBonus, score: total, sameRole, fillsDeficit };
        }
      }
    }
    if (!best) break;
    for (const r of best.out.roles.roles) counts[r] -= 1;
    for (const r of best.in.roles.roles) counts[r] += 1;
    remaining -= best.in.price ?? 0;
    gameChangers += gcDelta(best.out, best.in);
    outs.splice(outs.indexOf(best.out), 1);
    ins.splice(ins.indexOf(best.in), 1);
    result.push({ ...best, reason: opts.reason(best, counts) });
  }
  return result;
}

function deficitsOf(counts: Record<Role, number>, config: EngineConfig): RoleDeficit[] {
  return ROLES.flatMap((role) => {
    const min = config.minimums[role] ?? 0;
    return counts[role] < min ? [{ role, count: counts[role], min }] : [];
  });
}

/**
 * ¿Se respetan los mínimos? Por cada rol que pierde el mazo (lo tiene el que sale y no el que
 * entra), el recuento tras el cambio no puede quedar por debajo del mínimo.
 */
function keepsMinimums(
  out: RoleSet,
  inn: RoleSet,
  counts: Record<Role, number>,
  config: EngineConfig,
): boolean {
  return out.roles.every(
    (r) => inn.roles.includes(r) || counts[r] - 1 >= (config.minimums[r] ?? 0),
  );
}

function ownedSentence(c: AddCandidate): string {
  if (c.usedIn.length === 0) {
    return c.owned > 1
      ? `La tienes en tu colección (${c.owned} copias).`
      : "La tienes en tu colección.";
  }
  return `La tienes en tu colección (${c.owned} copias, ${c.available} libre${c.available === 1 ? "" : "s"}; también en ${c.usedIn.join(", ")}).`;
}

function purchaseSentence(c: PurchaseCandidate): string {
  const price = `cuesta unos ${formatEuros(c.price)} (precio de referencia de Cardmarket)`;
  return c.owned > 0
    ? `La tienes, pero ocupada en ${c.usedIn.join(", ")}: ${price}.`
    : `No la tienes: ${price}.`;
}
