import type {
  BlockRepository,
  CommentRepository,
  DeckComment,
  ReportRepository,
} from "@/domain/ports/moderation";
import type { NotificationRepository, ProfileRepository, PublicDecks } from "@/domain/ports/social";
import {
  cleanComment,
  cooledDown,
  COMMENT_MAX_LENGTH,
  COMMENT_MAX_LINKS,
  REPORTS_TO_HIDE,
  type CommentProblem,
  type ReportReason,
} from "@/domain/social/comments";
import { AppError, forbidden, notFound } from "./errors";
import { ensureUsername } from "./social";

export interface CommentDeps {
  comments: CommentRepository;
  blocks: BlockRepository;
  reports: ReportRepository;
  publicDecks: PublicDecks;
  profiles: ProfileRepository;
  notifications: NotificationRepository;
}

const PROBLEMS: Record<CommentProblem, string> = {
  empty: "El comentario está vacío.",
  too_long: `Como mucho ${COMMENT_MAX_LENGTH} caracteres.`,
  too_many_links: `Como mucho ${COMMENT_MAX_LINKS} enlaces por comentario.`,
};

/** Un mazo que se puede comentar: público u oculto (o mío). */
async function visibleDeck(
  deckId: string,
  viewerId: string | null,
  deps: Pick<CommentDeps, "publicDecks">,
) {
  const found = await deps.publicDecks.find(deckId, viewerId);
  if (!found || (found.deck.visibility === "private" && found.ownerId !== viewerId)) {
    throw notFound("Ese mazo no existe.");
  }
  return found;
}

export interface DeckCommentsView {
  comments: (DeckComment & { mine: boolean; canDelete: boolean })[];
  open: boolean;
  isOwner: boolean;
  /** Puedo escribir (con sesión, abiertos y sin bloqueos con el dueño). */
  canComment: boolean;
}

/**
 * Comentarios de un mazo. Sin los de gente que he bloqueado (o que me ha bloqueado) ni los
 * ocultos por denuncias; el dueño ve también los ocultos, para poder borrarlos.
 */
export async function deckComments(
  deckId: string,
  viewerId: string | null,
  deps: CommentDeps,
): Promise<DeckCommentsView> {
  const { ownerId } = await visibleDeck(deckId, viewerId, deps);
  const isOwner = ownerId === viewerId;
  const [list, open, hidden, blocked] = await Promise.all([
    deps.comments.forDeck(deckId, isOwner),
    deps.comments.isOpen(deckId),
    viewerId ? deps.blocks.hiddenFor(viewerId) : Promise.resolve(new Set<string>()),
    viewerId && !isOwner ? deps.blocks.eitherBlocked(viewerId, ownerId) : Promise.resolve(false),
  ]);
  return {
    comments: list
      .filter((c) => !hidden.has(c.author.id))
      .map((c) => ({
        ...c,
        mine: c.author.id === viewerId,
        canDelete: c.author.id === viewerId || isOwner,
      })),
    open,
    isOwner,
    canComment: viewerId !== null && open && !blocked,
  };
}

export async function addComment(
  viewerId: string,
  deckId: string,
  body: string,
  deps: CommentDeps,
) {
  const { deck, ownerId } = await visibleDeck(deckId, viewerId, deps);
  if (!(await deps.comments.isOpen(deckId))) {
    throw new AppError("comments_closed", "Este mazo no admite comentarios.", 403);
  }
  if (ownerId !== viewerId && (await deps.blocks.eitherBlocked(viewerId, ownerId))) {
    throw new AppError("blocked", "No puedes comentar en este mazo.", 403);
  }
  const clean = cleanComment(body);
  if ("problem" in clean) throw new AppError(`comment_${clean.problem}`, PROBLEMS[clean.problem]);
  if (!cooledDown(await deps.comments.lastByAuthor(viewerId), new Date())) {
    throw new AppError("too_fast", "Espera unos segundos antes de volver a comentar.", 429);
  }
  await ensureUsername(viewerId, deps);
  const id = await deps.comments.create({ deckId, authorId: viewerId, body: clean.body });
  if (ownerId !== viewerId) {
    await deps.notifications.create([
      { userId: ownerId, actorId: viewerId, type: "deck_comment", deckId, title: deck.name },
    ]);
  }
  return id;
}

/** Lo borra quien lo escribió, el dueño del mazo o un administrador. */
export async function deleteComment(
  viewerId: string,
  commentId: string,
  deps: Pick<CommentDeps, "comments">,
  isAdmin = false,
) {
  const c = await deps.comments.get(commentId);
  if (!c) throw notFound("Ese comentario no existe.");
  if (!isAdmin && c.author.id !== viewerId && c.deckOwnerId !== viewerId) throw forbidden();
  await deps.comments.delete(commentId);
}

/**
 * Denunciar un comentario (no los propios). Con `REPORTS_TO_HIDE` denuncias de personas
 * distintas se oculta hasta que lo revise un administrador.
 */
export async function reportComment(
  viewerId: string,
  commentId: string,
  reason: ReportReason,
  deps: Pick<CommentDeps, "comments" | "reports">,
) {
  const c = await deps.comments.get(commentId);
  if (!c) throw notFound("Ese comentario no existe.");
  if (c.author.id === viewerId)
    throw new AppError("own_comment", "No puedes denunciarte a ti mismo.");
  const reports = await deps.reports.report(commentId, viewerId, reason);
  if (reports >= REPORTS_TO_HIDE && !c.hidden) await deps.comments.setHidden(commentId, true);
  return { hidden: reports >= REPORTS_TO_HIDE || c.hidden };
}

export async function setCommentsOpen(
  viewerId: string,
  deckId: string,
  open: boolean,
  deps: Pick<CommentDeps, "comments">,
) {
  if (!(await deps.comments.setOpen(deckId, viewerId, open))) throw notFound("Ese mazo no existe.");
}

/** Revisión de un administrador: dejarlo visible (denuncias sin fundamento), ocultarlo o borrarlo. */
export async function moderateComment(
  commentId: string,
  action: "keep" | "hide" | "delete",
  deps: Pick<CommentDeps, "comments" | "reports">,
) {
  const c = await deps.comments.get(commentId);
  if (!c) throw notFound("Ese comentario no existe.");
  if (action === "delete") return deps.comments.delete(commentId);
  await deps.comments.setHidden(commentId, action === "hide");
  await deps.reports.resolve(commentId);
}

// ---------- bloqueos ----------

export async function setBlocked(
  viewerId: string,
  username: string,
  block: boolean,
  deps: Pick<CommentDeps, "blocks" | "profiles">,
) {
  const target = await deps.profiles.byUsername(username.replace(/^@/, "").toLowerCase());
  if (!target) throw notFound("Ese usuario no existe.");
  if (target.id === viewerId) throw new AppError("block_self", "No puedes bloquearte a ti mismo.");
  if (block) await deps.blocks.block(viewerId, target.id);
  else await deps.blocks.unblock(viewerId, target.id);
}
