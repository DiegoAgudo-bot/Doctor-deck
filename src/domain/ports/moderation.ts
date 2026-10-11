import type { ReportReason } from "../social/comments";
import type { Member } from "./play";

export interface DeckComment {
  id: string;
  deckId: string;
  author: Member;
  body: string;
  createdAt: Date;
  hidden: boolean;
  /** Denuncias sin revisar. */
  reports: number;
}

export interface CommentRepository {
  create(data: { deckId: string; authorId: string; body: string }): Promise<string>;
  get(id: string): Promise<(DeckComment & { deckOwnerId: string | null }) | null>;
  /** Comentarios de un mazo, del más viejo al más nuevo. Los ocultos solo si `withHidden`. */
  forDeck(deckId: string, withHidden: boolean): Promise<DeckComment[]>;
  count(deckId: string): Promise<number>;
  /** Todos los comentarios de una persona (para exportar sus datos). */
  byAuthor(authorId: string): Promise<DeckComment[]>;
  delete(id: string): Promise<void>;
  /** Fecha de su último comentario (contra el spam). */
  lastByAuthor(authorId: string): Promise<Date | null>;
  setHidden(id: string, hidden: boolean): Promise<void>;
  /** Si el dueño deja comentar en su mazo. */
  setOpen(deckId: string, ownerId: string, open: boolean): Promise<boolean>;
  isOpen(deckId: string): Promise<boolean>;
}

export interface BlockRepository {
  block(blockerId: string, blockedId: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  /** Si alguno de los dos ha bloqueado al otro. */
  eitherBlocked(a: string, b: string): Promise<boolean>;
  /** A quién he bloqueado. */
  blocked(userId: string): Promise<(Member & { blockedAt: Date })[]>;
  /** Ids de los que he bloqueado y de los que me han bloqueado (para no enseñar lo suyo). */
  hiddenFor(userId: string): Promise<Set<string>>;
}

export interface ReportedComment extends DeckComment {
  deck: { id: string; name: string };
  reasons: Partial<Record<ReportReason, number>>;
}

export interface ReportRepository {
  /** Devuelve las denuncias sin revisar que tiene ahora el comentario. */
  report(commentId: string, reporterId: string, reason: ReportReason): Promise<number>;
  /** Comentarios con denuncias sin revisar, los más denunciados primero. */
  pending(limit: number): Promise<ReportedComment[]>;
  /** Marca como revisadas las denuncias del comentario. */
  resolve(commentId: string): Promise<void>;
}
