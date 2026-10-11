import type {
  BlockRepository,
  CommentRepository,
  DeckComment,
  ReportRepository,
  ReportedComment,
} from "@/domain/ports/moderation";
import { REPORT_REASONS, type ReportReason } from "@/domain/social/comments";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

const MEMBER = { id: true, username: true, name: true, image: true } as const;
const INCLUDE = {
  author: { select: MEMBER },
  deck: { select: { publicId: true, name: true, userId: true } },
  _count: { select: { reports: { where: { reviewedAt: null } } } },
} satisfies Prisma.DeckCommentInclude;

type Row = Prisma.DeckCommentGetPayload<{ include: typeof INCLUDE }>;

const commentFromRow = (c: Row): DeckComment => ({
  id: c.publicId,
  deckId: c.deck.publicId,
  author: c.author,
  body: c.body,
  createdAt: c.createdAt,
  hidden: c.hiddenAt !== null,
  reports: c._count.reports,
});

const isReason = (r: string): r is ReportReason => r in REPORT_REASONS;

/** Comentarios, bloqueos y denuncias. */
export class PrismaModerationRepository
  implements CommentRepository, BlockRepository, ReportRepository
{
  constructor(private readonly db: Db) {}

  // ---------- comentarios ----------

  async create(data: { deckId: string; authorId: string; body: string }) {
    const deck = await this.db.deck.findUniqueOrThrow({
      where: { publicId: data.deckId },
      select: { id: true },
    });
    const c = await this.db.deckComment.create({
      data: { deckId: deck.id, authorId: data.authorId, body: data.body },
    });
    return c.publicId;
  }

  async get(id: string) {
    const c = await this.db.deckComment.findUnique({ where: { publicId: id }, include: INCLUDE });
    return c ? { ...commentFromRow(c), deckOwnerId: c.deck.userId } : null;
  }

  async forDeck(deckId: string, withHidden: boolean) {
    const rows = await this.db.deckComment.findMany({
      where: { deck: { publicId: deckId }, ...(withHidden ? {} : { hiddenAt: null }) },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return rows.map(commentFromRow);
  }

  async count(deckId: string) {
    return this.db.deckComment.count({ where: { deck: { publicId: deckId }, hiddenAt: null } });
  }

  async byAuthor(authorId: string) {
    const rows = await this.db.deckComment.findMany({
      where: { authorId },
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(commentFromRow);
  }

  async delete(id: string) {
    await this.db.deckComment.deleteMany({ where: { publicId: id } });
  }

  async lastByAuthor(authorId: string) {
    const c = await this.db.deckComment.findFirst({
      where: { authorId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return c?.createdAt ?? null;
  }

  async setHidden(id: string, hidden: boolean) {
    await this.db.deckComment.updateMany({
      where: { publicId: id },
      data: { hiddenAt: hidden ? new Date() : null },
    });
  }

  async setOpen(deckId: string, ownerId: string, open: boolean) {
    const { count } = await this.db.deck.updateMany({
      where: { publicId: deckId, userId: ownerId },
      data: { commentsOpen: open },
    });
    return count > 0;
  }

  async isOpen(deckId: string) {
    const d = await this.db.deck.findUnique({
      where: { publicId: deckId },
      select: { commentsOpen: true },
    });
    return d?.commentsOpen ?? false;
  }

  // ---------- bloqueos ----------

  async block(blockerId: string, blockedId: string) {
    await this.db.$transaction([
      this.db.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      }),
      // Bloquear rompe el seguimiento en los dos sentidos.
      this.db.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followedId: blockedId },
            { followerId: blockedId, followedId: blockerId },
          ],
        },
      }),
    ]);
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.db.block.deleteMany({ where: { blockerId, blockedId } });
  }

  async eitherBlocked(a: string, b: string) {
    return (
      (await this.db.block.count({
        where: {
          OR: [
            { blockerId: a, blockedId: b },
            { blockerId: b, blockedId: a },
          ],
        },
      })) > 0
    );
  }

  async blocked(userId: string) {
    const rows = await this.db.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: MEMBER } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt }));
  }

  async hiddenFor(userId: string) {
    const rows = await this.db.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
  }

  // ---------- denuncias ----------

  async report(commentId: string, reporterId: string, reason: ReportReason) {
    const c = await this.db.deckComment.findUnique({
      where: { publicId: commentId },
      select: { id: true },
    });
    if (!c) return 0;
    await this.db.commentReport.upsert({
      where: { commentId_reporterId: { commentId: c.id, reporterId } },
      create: { commentId: c.id, reporterId, reason },
      update: { reason, reviewedAt: null },
    });
    return this.db.commentReport.count({ where: { commentId: c.id, reviewedAt: null } });
  }

  async pending(limit: number): Promise<ReportedComment[]> {
    const rows = await this.db.deckComment.findMany({
      where: { reports: { some: { reviewedAt: null } } },
      include: {
        ...INCLUDE,
        reports: { where: { reviewedAt: null }, select: { reason: true } },
      },
      take: limit,
    });
    return rows
      .map((c) => {
        const reasons: Partial<Record<ReportReason, number>> = {};
        for (const r of c.reports) {
          const key = isReason(r.reason) ? r.reason : "other";
          reasons[key] = (reasons[key] ?? 0) + 1;
        }
        return {
          ...commentFromRow(c),
          deck: { id: c.deck.publicId, name: c.deck.name },
          reasons,
        };
      })
      .sort((a, b) => b.reports - a.reports || b.createdAt.getTime() - a.createdAt.getTime());
  }

  async resolve(commentId: string) {
    await this.db.commentReport.updateMany({
      where: { comment: { publicId: commentId }, reviewedAt: null },
      data: { reviewedAt: new Date() },
    });
  }
}
