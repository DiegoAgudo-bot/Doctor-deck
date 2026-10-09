import type { CardRepository } from "@/domain/ports/card-repository";
import type { DeckRepository, SavedDeckSummary } from "@/domain/ports/deck-repository";
import type {
  FollowRepository,
  NotificationRepository,
  ProfileRepository,
  PublicProfile,
} from "@/domain/ports/social";
import {
  USERNAME_HELP,
  usernameBase,
  usernameCandidates,
  usernameProblem,
} from "@/domain/social/username";

export class ProfileNotFoundError extends Error {
  constructor() {
    super("Ese usuario no existe");
  }
}

export class UsernameError extends Error {
  constructor(readonly problem: "format" | "reserved" | "taken") {
    super(
      problem === "taken"
        ? "Ese nombre de usuario ya lo tiene otra persona."
        : problem === "reserved"
          ? "Ese nombre de usuario no se puede usar."
          : `Nombre de usuario no válido. ${USERNAME_HELP}`,
    );
  }
}

export class CannotFollowSelfError extends Error {
  constructor() {
    super("No puedes seguirte a ti mismo.");
  }
}

/** El perfil del usuario, generándole un nombre de usuario si aún no tiene. */
export async function ensureUsername(
  userId: string,
  deps: { profiles: ProfileRepository },
): Promise<PublicProfile & { username: string }> {
  const profile = await deps.profiles.byId(userId);
  if (!profile) throw new ProfileNotFoundError();
  if (profile.username) return { ...profile, username: profile.username };
  const base = usernameBase(profile.name, (await deps.profiles.emailOf(userId)) ?? "");
  for (const candidate of usernameCandidates(base)) {
    if (await deps.profiles.setUsername(userId, candidate)) {
      return { ...profile, username: candidate };
    }
  }
  throw new UsernameError("taken");
}

export async function updateProfile(
  userId: string,
  changes: { username?: string | undefined; collectionPublic?: boolean | undefined },
  deps: { profiles: ProfileRepository },
) {
  if (changes.username !== undefined) {
    const username = changes.username.trim().toLowerCase();
    const problem = usernameProblem(username);
    if (problem) throw new UsernameError(problem);
    const current = await deps.profiles.byId(userId);
    if (current?.username !== username && !(await deps.profiles.setUsername(userId, username))) {
      throw new UsernameError("taken");
    }
  }
  if (changes.collectionPublic !== undefined) {
    await deps.profiles.setCollectionPublic(userId, changes.collectionPublic);
  }
  return ensureUsername(userId, deps);
}

export interface ProfileView {
  profile: PublicProfile & { username: string };
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  /** Los públicos; si es el propio perfil, todos. */
  decks: SavedDeckSummary[];
}

/** Perfil público de `username` visto por `viewerId` (o por alguien sin cuenta). */
export async function profileView(
  username: string,
  viewerId: string | null,
  deps: {
    profiles: ProfileRepository;
    follows: FollowRepository;
    decksFor: (userId: string) => DeckRepository;
  },
): Promise<ProfileView> {
  const profile = await deps.profiles.byUsername(username.toLowerCase());
  if (!profile?.username) throw new ProfileNotFoundError();
  const isMe = viewerId === profile.id;
  const [counts, isFollowing, decks] = await Promise.all([
    deps.follows.counts(profile.id),
    viewerId && !isMe ? deps.follows.isFollowing(viewerId, profile.id) : Promise.resolve(false),
    deps.decksFor(profile.id).list(),
  ]);
  return {
    profile: { ...profile, username: profile.username },
    ...counts,
    isMe,
    isFollowing,
    decks: isMe ? decks : decks.filter((d) => d.isPublic),
  };
}

export async function setFollowing(
  viewerId: string,
  username: string,
  follow: boolean,
  deps: { profiles: ProfileRepository; follows: FollowRepository },
) {
  const target = await deps.profiles.byUsername(username.toLowerCase());
  if (!target) throw new ProfileNotFoundError();
  if (target.id === viewerId) throw new CannotFollowSelfError();
  if (follow) await deps.follows.follow(viewerId, target.id);
  else await deps.follows.unfollow(viewerId, target.id);
  return deps.follows.counts(target.id);
}

type NotifyDeps = { follows: FollowRepository; notifications: NotificationRepository };

/** Avisa a los seguidores de un mazo nuevo, si es público. */
export async function announceNewDeck(
  actorId: string,
  deck: { id: string; name: string; isPublic: boolean },
  deps: NotifyDeps,
) {
  if (!deck.isPublic) return 0;
  const followers = await deps.follows.followerIds(actorId);
  await deps.notifications.create(
    followers.map((userId) => ({
      userId,
      actorId,
      type: "new_deck" as const,
      deckId: deck.id,
      title: deck.name,
    })),
  );
  return followers.length;
}

/**
 * Avisa a los seguidores de las cartas caras que acaba de añadir a su colección, solo si la tiene
 * pública (si no, el aviso contaría algo privado). Como mucho `maxPerAdd` avisos, las más caras.
 */
export async function announceBigCards(
  actorId: string,
  added: readonly { oracleId: string; name: string }[],
  deps: NotifyDeps & { profiles: ProfileRepository; cards: CardRepository },
  config: { bigCardEur: number; maxBigCardsPerAdd: number },
) {
  if (added.length === 0) return 0;
  const profile = await deps.profiles.byId(actorId);
  if (!profile?.collectionPublic) return 0;
  const prices = await deps.cards.findMinPrices([...new Set(added.map((a) => a.oracleId))]);
  const big = [...new Map(added.map((a) => [a.oracleId, a])).values()]
    .map((a) => ({ ...a, price: prices.get(a.oracleId) ?? 0 }))
    .filter((a) => a.price >= config.bigCardEur)
    .sort((a, b) => b.price - a.price)
    .slice(0, config.maxBigCardsPerAdd);
  if (big.length === 0) return 0;
  const followers = await deps.follows.followerIds(actorId);
  await deps.notifications.create(
    followers.flatMap((userId) =>
      big.map((c) => ({
        userId,
        actorId,
        type: "big_card" as const,
        cardId: c.oracleId,
        title: c.name,
        price: c.price,
      })),
    ),
  );
  return big.length * followers.length;
}
