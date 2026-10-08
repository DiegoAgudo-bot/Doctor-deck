import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card } from "../cards/types";
import type { ResolvedDeck } from "../deck/resolve";
import type { ResolvedRecommendation } from "../recommendations/types";
import { ROLES, type Role, type RoleClassifier, type RoleSet } from "../roles/types";
import type { EngineConfig } from "./config";
import { swapReason } from "./reason";

export interface EngineInput {
  deck: ResolvedDeck;
  recommendations: readonly ResolvedRecommendation[];
  /** Copias que tengo de cada carta, por oracleId. */
  owned: ReadonlyMap<string, number>;
  /** oracleIds que el usuario no quiere cortar. */
  locked: ReadonlySet<string>;
  /** oracleIds que el usuario ha descartado meter. */
  excluded?: ReadonlySet<string> | undefined;
  classifier: RoleClassifier;
  config: EngineConfig;
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

export interface AddCandidate extends ScoredCard {
  owned: number;
}

export interface SwapSuggestion {
  out: ScoredCard;
  in: AddCandidate;
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
  /** Cartas de mi colección recomendadas que no están en el mazo, de mejor a peor. */
  addCandidates: AddCandidate[];
}

const emptyCounts = (): Record<Role, number> =>
  Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;

/** Motor de sugerencias: propone cambios 1×1 usando solo cartas de la colección. */
export function suggestSwaps(input: EngineInput): SuggestionResult {
  const { deck, recommendations, owned, locked, classifier, config } = input;
  const excluded = input.excluded ?? new Set<string>();
  const { weights } = config;
  const score = (syn: number | null, incl: number | null) =>
    weights.synergy * (syn ?? 0) + weights.inclusion * (incl ?? 0);

  const recByOracle = new Map(recommendations.map((r) => [r.card.oracleId, r]));
  const commanderIds = new Set(deck.commanders.map((c) => c.oracleId));
  const deckIds = new Set([...commanderIds, ...deck.cards.map((c) => c.card.oracleId)]);
  const identity = combinedColorIdentity(deck.commanders);

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
  const deficitsOf = (counts: Record<Role, number>): RoleDeficit[] =>
    ROLES.flatMap((role) => {
      const min = config.minimums[role] ?? 0;
      return counts[role] < min ? [{ role, count: counts[role], min }] : [];
    });

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

  // 3. Candidatos a entrar: recomendadas ∩ colección, fuera del mazo, legales y en identidad de color.
  const addCandidates: AddCandidate[] = recommendations
    .filter(
      (r) =>
        (owned.get(r.card.oracleId) ?? 0) > 0 &&
        !deckIds.has(r.card.oracleId) &&
        !excluded.has(r.card.oracleId) &&
        r.card.legalCommander &&
        !r.card.isBasicLand &&
        // Nunca fuera de la identidad de color del comandante (sin comandante, nada que proponer).
        deck.commanders.length > 0 &&
        fitsColorIdentity(r.card, identity),
    )
    .map((r) => ({ ...scored(r.card), owned: owned.get(r.card.oracleId) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name));

  // 6. Emparejado voraz: en cada paso, el mejor par válido según los recuentos actuales.
  const counts = { ...roleCounts };
  const outs = [...cutCandidates];
  const ins = [...addCandidates];
  const swaps: SwapSuggestion[] = [];

  while (swaps.length < config.maxSuggestions) {
    let best: Omit<SwapSuggestion, "reason"> | null = null;
    for (const out of outs) {
      for (const inn of ins) {
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
        const total = improvement + weights.roleBonus * roleBonus;
        if (!best || total > best.score + 1e-9) {
          best = { out, in: inn, improvement, roleBonus, score: total, sameRole, fillsDeficit };
        }
      }
    }
    if (!best) break;
    for (const r of best.out.roles.roles) counts[r] -= 1;
    for (const r of best.in.roles.roles) counts[r] += 1;
    outs.splice(outs.indexOf(best.out), 1);
    ins.splice(ins.indexOf(best.in), 1);
    swaps.push({ ...best, reason: swapReason(best, { counts, minimums: config.minimums }) });
  }

  return { roleCounts, deficits: deficitsOf(roleCounts), swaps, cutCandidates, addCandidates };
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
