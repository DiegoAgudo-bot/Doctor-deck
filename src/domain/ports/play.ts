import type { PublicProfile } from "./social";

export type Member = Pick<PublicProfile, "id" | "username" | "name" | "image">;

export interface Group {
  /** Id público (uuid). */
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  createdAt: Date;
  members: (Member & { joinedAt: Date })[];
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: number;
  games: number;
  lastGameAt: Date | null;
}

export interface GroupRepository {
  create(data: { ownerId: string; name: string; description: string }): Promise<string>;
  get(id: string): Promise<Group | null>;
  byInvite(code: string): Promise<GroupSummary | null>;
  /** Grupos de los que es miembro. */
  forUser(userId: string): Promise<GroupSummary[]>;
  isMember(groupId: string, userId: string): Promise<boolean>;
  join(groupId: string, userId: string): Promise<void>;
  /** Quita a un miembro (no al dueño). */
  removeMember(groupId: string, userId: string): Promise<void>;
  update(id: string, data: { name?: string; description?: string }): Promise<void>;
  /** Nuevo enlace de invitación (el anterior deja de valer). */
  newInvite(id: string): Promise<string>;
  delete(id: string): Promise<void>;
  /** Ids de los usuarios con los que comparto algún grupo (sin mí). */
  groupmateIds(userId: string): Promise<string[]>;
}

export interface GamePlayerData {
  userId: string | null;
  guestName: string | null;
  /** Id público del mazo guardado del jugador (o null). */
  deckId: string | null;
  deckName: string;
  commanderNames: string[];
  winner: boolean;
}

export interface NewGame {
  groupId: string | null;
  createdById: string;
  playedAt: Date;
  turns: number | null;
  notes: string;
  players: GamePlayerData[];
}

export interface GamePlayer extends GamePlayerData {
  seat: number;
  user: Member | null;
}

export interface Game {
  id: string;
  group: { id: string; name: string } | null;
  createdById: string;
  playedAt: Date;
  turns: number | null;
  notes: string;
  players: GamePlayer[];
}

export interface GameFilter {
  groupId?: string;
  /** Partidas en las que jugó este usuario. */
  userId?: string;
  /** Partidas en las que se jugó este mazo. */
  deckId?: string;
}

export interface GameRepository {
  create(game: NewGame): Promise<string>;
  get(id: string): Promise<Game | null>;
  /** De la más reciente a la más vieja. */
  list(filter: GameFilter, limit: number, before?: Date): Promise<Game[]>;
  delete(id: string): Promise<void>;
}
