import type { DeckCommentsView } from "@/application/comments";
import type { CardHolder, GroupDeck } from "@/application/groups";
import type { Card } from "@/domain/cards/types";
import type { FeedItem, FeedType } from "@/domain/feed/feed";
import type { Standing } from "@/domain/play/stats";
import type { Loan } from "@/domain/ports/loans";
import type { DeckComment, ReportedComment } from "@/domain/ports/moderation";
import type { Game, Group, GroupSummary, Member } from "@/domain/ports/play";
import type { ReportReason } from "@/domain/social/comments";
import { cardDTO, savedDeckSummaryDTO, type CardDTO, type SavedDeckSummaryDTO } from "./dto";

/*
 * Formas JSON de la parte social de la fase 21: grupos, partidas, préstamos, feed y comentarios.
 * Nunca llevan ids internos de usuario: a la gente se la nombra por su nombre de usuario.
 */

export interface MemberDTO {
  username: string | null;
  name: string;
  image: string | null;
}

export const memberDTO = (m: Member): MemberDTO => ({
  username: m.username,
  name: m.name,
  image: m.image,
});

export interface GroupSummaryDTO {
  id: string;
  name: string;
  description: string;
  isOwner: boolean;
  members: number;
  games: number;
  lastGameAt: string | null;
}

export const groupSummaryDTO = (g: GroupSummary, viewerId: string | null): GroupSummaryDTO => ({
  id: g.id,
  name: g.name,
  description: g.description,
  isOwner: g.ownerId === viewerId,
  members: g.members,
  games: g.games,
  lastGameAt: g.lastGameAt?.toISOString() ?? null,
});

export interface StandingDTO {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  streak: number;
  lastPlayed: string;
  /** Jugadores: su usuario (null si es invitado). Mazos: id del mazo guardado (o null). */
  username: string | null;
  deckId: string | null;
}

export interface GameStatsDTO {
  games: number;
  players: StandingDTO[];
  decks: StandingDTO[];
  recent: GameDTO[];
}

export interface GamePlayerDTO {
  seat: number;
  user: MemberDTO | null;
  guestName: string | null;
  deckId: string | null;
  deckName: string;
  commanderNames: string[];
  winner: boolean;
}

export interface GameDTO {
  id: string;
  group: { id: string; name: string } | null;
  playedAt: string;
  turns: number | null;
  notes: string;
  players: GamePlayerDTO[];
  /** Puedo borrarla (la registré o soy el dueño del grupo). */
  canDelete: boolean;
}

export const gameDTO = (
  g: Game,
  viewerId: string,
  groupOwnerId: string | null = null,
): GameDTO => ({
  id: g.id,
  group: g.group,
  playedAt: g.playedAt.toISOString(),
  turns: g.turns,
  notes: g.notes,
  players: g.players.map((p) => ({
    seat: p.seat,
    user: p.user ? memberDTO(p.user) : null,
    guestName: p.guestName,
    deckId: p.deckId,
    deckName: p.deckName,
    commanderNames: p.commanderNames,
    winner: p.winner,
  })),
  canDelete: g.createdById === viewerId || groupOwnerId === viewerId,
});

export function standingDTO(
  s: Standing,
  kind: "player" | "deck",
  games: readonly Game[],
): StandingDTO {
  const user =
    kind === "player"
      ? games.flatMap((g) => g.players).find((p) => p.userId === s.key)?.user
      : undefined;
  return {
    name: s.name,
    games: s.games,
    wins: s.wins,
    winRate: s.winRate,
    streak: s.streak,
    lastPlayed: s.lastPlayed.toISOString(),
    username: user?.username ?? null,
    deckId: kind === "deck" && !s.key.startsWith("name:") ? s.key : null,
  };
}

export function gameStatsDTO(
  stats: { games: number; players: Standing[]; decks: Standing[]; recent: Game[] },
  viewerId: string,
  groupOwnerId: string | null = null,
): GameStatsDTO {
  return {
    games: stats.games,
    players: stats.players.map((s) => standingDTO(s, "player", stats.recent)),
    decks: stats.decks.map((s) => standingDTO(s, "deck", stats.recent)),
    recent: stats.recent.map((g) => gameDTO(g, viewerId, groupOwnerId)),
  };
}

export interface GroupDTO {
  id: string;
  name: string;
  description: string;
  isOwner: boolean;
  /** Código del enlace de invitación (/groups/join/{inviteCode}). */
  inviteCode: string;
  createdAt: string;
  members: (MemberDTO & { joinedAt: string; isOwner: boolean; isMe: boolean })[];
  stats: GameStatsDTO;
}

export const groupDTO = (
  g: Group,
  viewerId: string,
  stats: Parameters<typeof gameStatsDTO>[0],
): GroupDTO => ({
  id: g.id,
  name: g.name,
  description: g.description,
  isOwner: g.ownerId === viewerId,
  inviteCode: g.inviteCode,
  createdAt: g.createdAt.toISOString(),
  members: g.members.map((m) => ({
    ...memberDTO(m),
    joinedAt: m.joinedAt.toISOString(),
    isOwner: m.id === g.ownerId,
    isMe: m.id === viewerId,
  })),
  stats: gameStatsDTO(stats, viewerId, g.ownerId),
});

export interface GroupDeckDTO extends SavedDeckSummaryDTO {
  owner: MemberDTO;
}

export const groupDeckDTO = (d: GroupDeck, cards: ReadonlyMap<string, Card>): GroupDeckDTO => ({
  ...savedDeckSummaryDTO(d, cards),
  owner: memberDTO(d.owner),
});

export interface CardHolderDTO {
  member: MemberDTO;
  owned: number;
  free: number;
  usedIn: string[];
}

export const cardHolderDTO = (h: CardHolder): CardHolderDTO => ({
  member: memberDTO(h.member),
  owned: h.owned,
  free: h.free,
  usedIn: h.usedIn,
});

export interface GroupCardDTO {
  card: CardDTO;
  /** Copias que me faltan (solo en "me pueden dejar"). */
  wanted: number;
  holders: CardHolderDTO[];
}

export interface LoanDTO {
  id: string;
  card: CardDTO | null;
  name: string;
  quantity: number;
  note: string;
  createdAt: string;
  returnedAt: string | null;
  lender: MemberDTO;
  borrower: MemberDTO | null;
  borrowerName: string | null;
}

export interface LoansDTO {
  lent: LoanDTO[];
  borrowed: LoanDTO[];
}

export const loanDTO = (l: Loan, cards: ReadonlyMap<string, Card>): LoanDTO => {
  const card = cards.get(l.oracleId);
  return {
    id: l.id,
    card: card ? cardDTO(card) : null,
    name: l.name,
    quantity: l.quantity,
    note: l.note,
    createdAt: l.createdAt.toISOString(),
    returnedAt: l.returnedAt?.toISOString() ?? null,
    lender: memberDTO(l.lender),
    borrower: l.borrower ? memberDTO(l.borrower) : null,
    borrowerName: l.borrowerName,
  };
};

export interface CommentDTO {
  id: string;
  author: MemberDTO;
  body: string;
  createdAt: string;
  hidden: boolean;
  mine: boolean;
  canDelete: boolean;
}

export interface DeckCommentsDTO {
  comments: CommentDTO[];
  open: boolean;
  isOwner: boolean;
  canComment: boolean;
}

export const deckCommentsDTO = (v: DeckCommentsView): DeckCommentsDTO => ({
  open: v.open,
  isOwner: v.isOwner,
  canComment: v.canComment,
  comments: v.comments.map((c) => ({
    id: c.id,
    author: memberDTO(c.author),
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    hidden: c.hidden,
    mine: c.mine,
    canDelete: c.canDelete,
  })),
});

export interface ReportedCommentDTO {
  id: string;
  author: MemberDTO;
  body: string;
  createdAt: string;
  hidden: boolean;
  reports: number;
  reasons: Partial<Record<ReportReason, number>>;
  deck: { id: string; name: string };
}

export const reportedCommentDTO = (c: ReportedComment): ReportedCommentDTO => ({
  id: c.id,
  author: memberDTO(c.author),
  body: c.body,
  createdAt: c.createdAt.toISOString(),
  hidden: c.hidden,
  reports: c.reports,
  reasons: c.reasons,
  deck: c.deck,
});

export type { DeckComment };

type FeedDeck = Extract<FeedItem, { type: "deck" }>["deck"];
export interface FeedDeckDTO {
  id: string;
  name: string;
  commanders: string[];
  commanderCard: CardDTO | null;
}

/** Un elemento del feed para la API: fechas en ISO, el actor sin id y el mazo con su comandante. */
export type FeedItemDTO = { id: string; at: string; actor: { username: string; name: string } } & (
  | { type: "deck"; deck: FeedDeckDTO }
  | { type: "like"; deck: FeedDeckDTO; owner: { username: string } }
  | { type: "comment"; deck: FeedDeckDTO; excerpt: string }
  | { type: "game"; game: Extract<FeedItem, { type: "game" }>["game"] }
  | { type: "trade"; partner: { username: string }; cards: number }
);

export interface FeedDTO {
  items: FeedItemDTO[];
  /** Para la página siguiente (`?before=`), o null si no hay más. */
  next: string | null;
  /** A cuánta gente sigo (seguidos + compañeros de grupo). */
  following: number;
}

export const FEED_TYPES: readonly FeedType[] = ["deck", "like", "comment", "game", "trade"];

export function feedItemDTO(i: FeedItem, cards: ReadonlyMap<string, Card>): FeedItemDTO {
  const base = {
    id: i.id,
    at: i.at.toISOString(),
    actor: { username: i.actor.username, name: i.actor.name },
  };
  const deck = (d: FeedDeck): FeedDeckDTO => {
    const c = d.commanderIds.map((id) => cards.get(id)).find(Boolean);
    return {
      id: d.id,
      name: d.name,
      commanders: d.commanders,
      commanderCard: c ? cardDTO(c) : null,
    };
  };
  switch (i.type) {
    case "deck":
      return { ...base, type: "deck", deck: deck(i.deck) };
    case "like":
      return { ...base, type: "like", deck: deck(i.deck), owner: i.owner };
    case "comment":
      return { ...base, type: "comment", deck: deck(i.deck), excerpt: i.excerpt };
    case "game":
      return { ...base, type: "game", game: i.game };
    case "trade":
      return { ...base, type: "trade", partner: i.partner, cards: i.cards };
  }
}

/** Los oracleIds de comandantes que necesita el feed (para buscarlos de una vez). */
export const feedCommanderIds = (items: readonly FeedItem[]) => [
  ...new Set(items.flatMap((i) => ("deck" in i ? i.deck.commanderIds.slice(0, 1) : []))),
];
