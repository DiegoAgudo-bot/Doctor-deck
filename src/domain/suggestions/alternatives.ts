import { combinedColorIdentity, fitsColorIdentity } from "../cards/commander";
import type { Card } from "../cards/types";
import type { ResolvedDeck } from "../deck/resolve";
import type { ResolvedRecommendation } from "../recommendations/types";
import type { RoleClassifier } from "../roles/types";
import type { EngineConfig } from "./config";
import type { CardUsage } from "./engine";

export interface Alternative {
  card: Card;
  /** Precio de referencia de la más barata (EUR), si se sabe. */
  price: number | null;
  /** La tengo libre en la colección: no hay que comprarla. */
  owned: boolean;
  synergy: number | null;
  inclusion: number | null;
  /** a·synergy + b·inclusion, como en el motor. */
  score: number;
}

export interface CheaperAlternatives {
  /** La carta que falta (y es cara). */
  card: Card;
  price: number;
  alternatives: Alternative[];
}

export interface AlternativesInput {
  deck: ResolvedDeck;
  /** Cartas que hay que comprar, con su precio de referencia. */
  missing: readonly { card: Card; price: number }[];
  recommendations: readonly ResolvedRecommendation[];
  owned: ReadonlyMap<string, number>;
  usage?: ReadonlyMap<string, CardUsage> | undefined;
  /** Precio de referencia de las recomendadas, por oracleId. */
  prices: ReadonlyMap<string, number>;
  classifier: RoleClassifier;
  config: EngineConfig;
  /** Solo se buscan alternativas a las cartas que cuestan al menos esto (EUR). */
  minPrice?: number;
  /** La alternativa tiene que costar como mucho esta fracción del precio de la que falta. */
  maxRatio?: number;
  perCard?: number;
}

export const ALTERNATIVES_MIN_PRICE = 3;

/**
 * Para cada carta cara que falta, otras recomendadas para el comandante que hacen el mismo papel
 * (comparten su rol principal) y que tengo libres o cuestan mucho menos: primero las que tengo,
 * luego por puntuación. No se repite una alternativa que ya está en el mazo.
 */
export function cheaperAlternatives(input: AlternativesInput): CheaperAlternatives[] {
  const { deck, classifier, config } = input;
  const minPrice = input.minPrice ?? ALTERNATIVES_MIN_PRICE;
  const maxRatio = input.maxRatio ?? 0.5;
  const perCard = input.perCard ?? 3;
  const identity = combinedColorIdentity(deck.commanders);
  const inDeck = new Set([
    ...deck.commanders.map((c) => c.oracleId),
    ...deck.cards.map((c) => c.card.oracleId),
  ]);
  const free = (oracleId: string) =>
    (input.owned.get(oracleId) ?? 0) - (input.usage?.get(oracleId)?.quantity ?? 0) > 0;
  const pool = input.recommendations
    .filter(
      (r) =>
        !inDeck.has(r.card.oracleId) &&
        r.card.legalCommander &&
        !r.card.isBasicLand &&
        fitsColorIdentity(r.card, identity),
    )
    .map((r) => ({
      roles: classifier.classify(r.card).roles,
      alt: {
        card: r.card,
        price: input.prices.get(r.card.oracleId) ?? null,
        owned: free(r.card.oracleId),
        synergy: r.synergy,
        inclusion: r.inclusion,
        score:
          config.weights.synergy * (r.synergy ?? 0) + config.weights.inclusion * (r.inclusion ?? 0),
      } satisfies Alternative,
    }));

  return input.missing
    .filter((m) => m.price >= minPrice)
    .sort((a, b) => b.price - a.price || a.card.name.localeCompare(b.card.name))
    .flatMap((m) => {
      const { primary } = classifier.classify(m.card);
      const alternatives = pool
        .filter(
          (a) =>
            a.roles.includes(primary) &&
            (a.alt.owned || (a.alt.price !== null && a.alt.price <= m.price * maxRatio)),
        )
        .map((a) => a.alt)
        .sort(
          (a, b) =>
            Number(b.owned) - Number(a.owned) ||
            b.score - a.score ||
            a.card.name.localeCompare(b.card.name),
        )
        .slice(0, perCard);
      return alternatives.length > 0 ? [{ card: m.card, price: m.price, alternatives }] : [];
    });
}
