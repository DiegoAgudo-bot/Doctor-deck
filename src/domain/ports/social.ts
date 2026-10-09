import type { SavedDeck, SavedDeckSummary } from "./deck-repository";

/** Lo que se puede enseñar de un usuario a otros. Nunca el email. */
export interface PublicProfile {
  id: string;
  /** null hasta que se genera (la primera vez que hace falta). */
  username: string | null;
  name: string;
  image: string | null;
  collectionPublic: boolean;
  createdAt: Date;
}

export interface ProfileSummary extends PublicProfile {
  followers: number;
  publicDecks: number;
}

export interface ProfileRepository {
  byId(id: string): Promise<PublicProfile | null>;
  byUsername(username: string): Promise<PublicProfile | null>;
  /** Email de un usuario, solo para generar su nombre de usuario. */
  emailOf(id: string): Promise<string | null>;
  /** false si ese nombre ya lo tiene otro. */
  setUsername(userId: string, username: string): Promise<boolean>;
  setCollectionPublic(userId: string, value: boolean): Promise<void>;
  /** Por nombre o usuario (o, sin texto, los que más mazos públicos tienen). Solo con username. */
  search(query: string, limit: number): Promise<ProfileSummary[]>;
}

export interface FollowRepository {
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  counts(userId: string): Promise<{ followers: number; following: number }>;
  followerIds(userId: string): Promise<string[]>;
}

export type NotificationType = "new_deck" | "big_card";

export interface NewNotification {
  userId: string;
  actorId: string;
  type: NotificationType;
  /** new_deck: publicId del mazo. */
  deckId?: string | null;
  /** big_card: oracleId de la carta. */
  cardId?: string | null;
  /** Nombre del mazo o de la carta. */
  title: string;
  price?: number | null;
}

export interface Notification extends Required<NewNotification> {
  id: string;
  actor: Pick<PublicProfile, "username" | "name">;
  createdAt: Date;
  read: boolean;
}

export interface NotificationRepository {
  create(items: readonly NewNotification[]): Promise<void>;
  list(userId: string, limit: number): Promise<Notification[]>;
  unreadCount(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
}

/** Mazos públicos de cualquiera (el resto de operaciones de mazos son siempre del dueño). */
export interface PublicDecks {
  /** El mazo si es público o es de `viewerId`; si no, null. */
  find(id: string, viewerId: string | null): Promise<{ deck: SavedDeck; ownerId: string } | null>;
  /** Los últimos mazos públicos (de usuarios con nombre de usuario). */
  recent(limit: number): Promise<(SavedDeckSummary & { ownerId: string })[]>;
}
