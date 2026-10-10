import {
  sortCommunity,
  summarizeOwnership,
  type CommunitySort,
  type DeckOwnershipSummary,
} from "@/domain/community/rank";
import { deckFacts } from "@/domain/deck/facts";
import type { CardRepository } from "@/domain/ports/card-repository";
import type {
  CommunityDeckRow,
  CommunityFilters,
  FollowRepository,
  ProfileRepository,
  PublicDecks,
} from "@/domain/ports/social";
import type { CardUsage } from "@/domain/suggestions/engine";

/** Como mucho se ordenan los últimos N mazos que cumplen los filtros. */
export const COMMUNITY_MAX_CANDIDATES = 500;
const FACTS_BATCH = 200;

/**
 * Calcula identidad y bracket de los mazos que no los tienen (o de todos, con `all`: tras
 * `scryfall:sync`, por si cambia la lista de game changers). Devuelve cuántos actualizó.
 */
export async function refreshDeckFacts(
  deps: { publicDecks: PublicDecks; cards: CardRepository },
  opts: { all: boolean },
): Promise<number> {
  let updated = 0;
  for (let offset = 0; ; offset += opts.all ? FACTS_BATCH : 0) {
    const decks = await deps.publicDecks.withoutFacts(opts.all, FACTS_BATCH, offset);
    if (decks.length === 0) break;
    const ids = [
      ...new Set(decks.flatMap((d) => [...d.commanders, ...d.cards.map((c) => c.oracleId)])),
    ];
    const byId = new Map((await deps.cards.findCardsByOracleIds(ids)).map((c) => [c.oracleId, c]));
    for (const d of decks) {
      const facts = deckFacts(
        d.commanders.flatMap((id) => byId.get(id) ?? []),
        d.cards.flatMap((c) => {
          const card = byId.get(c.oracleId);
          return card ? [{ card, quantity: c.quantity }] : [];
        }),
      );
      await deps.publicDecks.setFacts(d.id, facts);
      updated += 1;
    }
    if (decks.length < FACTS_BATCH) break;
  }
  return updated;
}

export interface BrowseCommunityRequest {
  viewerId: string | null;
  filters: Omit<CommunityFilters, "ownerIds"> & {
    /** Solo de gente que sigo (necesita sesión). */
    following?: boolean | undefined;
    /** Solo los de este usuario (perfil). */
    username?: string | undefined;
  };
  sort: CommunitySort;
  offset: number;
  limit: number;
  /** Mi colección (copias por oracleId) y lo que usan mis mazos guardados. */
  owned: ReadonlyMap<string, number>;
  usage?: ReadonlyMap<string, CardUsage> | undefined;
}

export interface CommunityItem {
  deck: CommunityDeckRow;
  ownership: DeckOwnershipSummary;
  liked: boolean;
}

/** Comunidad: mazos públicos filtrados, con cuánto tengo de cada uno, ordenados y paginados. */
export async function browseCommunity(
  req: BrowseCommunityRequest,
  deps: {
    publicDecks: PublicDecks;
    cards: CardRepository;
    follows: FollowRepository;
    profiles: ProfileRepository;
  },
): Promise<{ items: CommunityItem[]; total: number }> {
  await refreshDeckFacts(deps, { all: false });

  const { following, username, ...filters } = req.filters;
  let ownerIds: string[] | undefined;
  if (following) ownerIds = req.viewerId ? await deps.follows.followingIds(req.viewerId) : [];
  if (username) {
    const profile = await deps.profiles.byUsername(username.toLowerCase());
    ownerIds = profile ? (ownerIds ?? [profile.id]).filter((id) => id === profile.id) : [];
  }
  if (ownerIds?.length === 0) return { items: [], total: 0 };

  const decks = await deps.publicDecks.search(
    { ...filters, ...(ownerIds ? { ownerIds } : {}) },
    COMMUNITY_MAX_CANDIDATES,
  );
  const ids = [...new Set(decks.flatMap((d) => d.cards.map((c) => c.oracleId)))];
  const [basics, prices] = await Promise.all([
    deps.cards.findBasicLandIds(ids),
    // Solo hace falta el precio de lo que no tengo.
    deps.cards.findMinPrices(ids.filter((id) => (req.owned.get(id) ?? 0) === 0)),
  ]);
  const ranked = sortCommunity(
    decks.map((deck) => ({
      deck,
      ownership: summarizeOwnership(deck, { owned: req.owned, usage: req.usage, basics, prices }),
    })),
    req.sort,
  );
  const page = ranked.slice(req.offset, req.offset + req.limit);
  const liked = req.viewerId
    ? await deps.publicDecks.likedBy(
        req.viewerId,
        page.map((p) => p.deck.id),
      )
    : new Set<string>();
  return {
    items: page.map((p) => ({ ...p, liked: liked.has(p.deck.id) })),
    total: ranked.length,
  };
}
