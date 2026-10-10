import type { DeckFacts } from "../deck/facts";
import type { SavedDeck, SavedDeckSummary } from "./deck-repository";

/** Lo que se puede enseñar de un usuario a otros. Nunca el email. */
export interface PublicProfile {
  id: string;
  /** null hasta que se genera (la primera vez que hace falta). */
  username: string | null;
  name: string;
  image: string | null;
  collectionPublic: boolean;
  /** Lista de deseos y "para cambiar" públicas. */
  tradesPublic: boolean;
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
  setTradesPublic(userId: string, value: boolean): Promise<void>;
  /** Usuarios con nombre de usuario y listas de intercambio públicas. */
  publicTraders(): Promise<PublicProfile[]>;
  /** % de bajada de precio a partir del que avisar (null = no avisar). Ajuste privado. */
  priceAlertPercent(userId: string): Promise<number | null>;
  setPriceAlertPercent(userId: string, percent: number | null): Promise<void>;
  /** Usuarios con avisos de precio activados. */
  priceAlertUsers(): Promise<{ id: string; percent: number }[]>;
  /** Por nombre o usuario (o, sin texto, los que más mazos públicos tienen). Solo con username. */
  search(query: string, limit: number): Promise<ProfileSummary[]>;
}

export interface FollowRepository {
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  counts(userId: string): Promise<{ followers: number; following: number }>;
  followerIds(userId: string): Promise<string[]>;
  /** A quién sigue `userId`. */
  followingIds(userId: string): Promise<string[]>;
}

export type NotificationType = "new_deck" | "big_card" | "price_drop" | "trade_match";

export interface NewNotification {
  userId: string;
  actorId: string;
  type: NotificationType;
  /** new_deck: publicId del mazo. */
  deckId?: string | null;
  /** big_card y price_drop: oracleId de la carta. */
  cardId?: string | null;
  /** Nombre del mazo o de la carta. */
  title: string;
  price?: number | null;
  /** price_drop: precio de referencia (el máximo de antes). */
  prevPrice?: number | null;
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
  /** Cartas sobre las que ya se avisó a `userId` con ese tipo desde `since`. */
  recentCardIds(userId: string, type: NotificationType, since: Date): Promise<Set<string>>;
}

/** Mazos públicos de cualquiera (el resto de operaciones de mazos son siempre del dueño). */
export interface CommunityFilters {
  /** Texto en el nombre del mazo o de sus comandantes. */
  q?: string | undefined;
  /** Identidad de color exacta ("WR"; "" = incolora). */
  colors?: string | undefined;
  /** Bracket estimado exacto (2, 3 o 4). */
  bracket?: number | undefined;
  /** Solo los mazos de estos usuarios (gente que sigo, un perfil…). */
  ownerIds?: readonly string[] | undefined;
}

/** Un mazo público con lo necesario para la Comunidad: dueño, fecha, me gusta y cartas. */
export interface CommunityDeckRow extends SavedDeckSummary {
  ownerId: string;
  createdAt: Date;
  likes: number;
  /** Bracket estimado guardado (null si aún no se ha calculado). */
  bracket: number | null;
  /** Comandantes incluidos, por oracleId. */
  cards: { oracleId: string; quantity: number }[];
}

/** Lo necesario para calcular `DeckFacts` de un mazo guardado. */
export interface DeckForFacts {
  id: string;
  commanders: string[];
  cards: { oracleId: string; quantity: number }[];
}

export interface PublicDecks {
  /** El mazo si es público u oculto, o es de `viewerId`; si no, null. */
  find(id: string, viewerId: string | null): Promise<{ deck: SavedDeck; ownerId: string } | null>;
  /** Mazos públicos (de usuarios con nombre de usuario), del más nuevo al más viejo. */
  search(filters: CommunityFilters, limit: number): Promise<CommunityDeckRow[]>;
  /** De estos mazos, a cuáles les ha dado "me gusta" `viewerId`. */
  likedBy(viewerId: string, deckIds: readonly string[]): Promise<Set<string>>;
  /**
   * Da o quita "me gusta" a un mazo que `viewerId` puede ver y no es suyo. Devuelve el nuevo
   * recuento, o null si no existe, es privado o es suyo.
   */
  setLike(viewerId: string, deckId: string, like: boolean): Promise<{ likes: number } | null>;
  likes(deckId: string): Promise<number>;
  /** Mazos sin `DeckFacts` calculados (o todos, con `all`; paginado con `offset`). */
  withoutFacts(all: boolean, limit: number, offset: number): Promise<DeckForFacts[]>;
  setFacts(deckId: string, facts: DeckFacts): Promise<void>;
}
