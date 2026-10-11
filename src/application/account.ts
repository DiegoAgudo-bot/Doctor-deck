import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { RoleOverrideRepository } from "@/domain/ports/role-overrides";
import type { FollowRepository, ProfileRepository } from "@/domain/ports/social";
import type { TradeProposalRepository } from "@/domain/ports/trade-proposals";
import type { TradeRepository } from "@/domain/ports/trades";
import type { LoanRepository } from "@/domain/ports/loans";
import type { BlockRepository, CommentRepository } from "@/domain/ports/moderation";
import type { GameRepository, GroupRepository } from "@/domain/ports/play";

export class AccountConfirmationError extends Error {
  constructor() {
    super("Para borrar la cuenta escribe tu email exactamente como lo tienes en Ajustes.");
  }
}

/**
 * Borra mi cuenta y todo lo mío. Hay que confirmarlo escribiendo mi email (vale también para
 * quien entra con Google y no tiene contraseña).
 */
export async function deleteAccount(
  userId: string,
  confirmEmail: string,
  deps: { profiles: ProfileRepository },
): Promise<void> {
  const email = await deps.profiles.emailOf(userId);
  if (!email || email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
    throw new AccountConfirmationError();
  }
  await deps.profiles.deleteAccount(userId);
}

export interface ExportDeps {
  profiles: ProfileRepository;
  follows: FollowRepository;
  collection: CollectionRepository;
  decks: DeckRepository;
  trades: TradeRepository;
  roleOverrides: RoleOverrideRepository;
  proposals: TradeProposalRepository;
  /** Fase 21: grupos, partidas, préstamos, comentarios y bloqueos. */
  groups: GroupRepository;
  games: GameRepository;
  loans: LoanRepository;
  comments: CommentRepository;
  blocks: BlockRepository;
}

/**
 * Todos mis datos en un JSON (derecho de acceso y portabilidad del RGPD): perfil, colección,
 * mazos con su lista, listas de intercambio, roles corregidos, propuestas y a quién sigo. Sin ids
 * internos: los mazos y propuestas van con su id público y las personas con su nombre de usuario.
 */
export async function exportMyData(userId: string, deps: ExportDeps, now = new Date()) {
  const [profile, email, entries, summaries, wishes, keeps, roles, proposals, following] =
    await Promise.all([
      deps.profiles.byId(userId),
      deps.profiles.emailOf(userId),
      deps.collection.entries(),
      deps.decks.list(),
      deps.trades.wishes(),
      deps.trades.keeps(),
      deps.roleOverrides.all(),
      deps.proposals.listFor(userId),
      deps.follows.followingIds(userId),
    ]);
  const [decks, groups, games, loans, comments, blocked] = await Promise.all([
    Promise.all(summaries.map((d) => deps.decks.get(d.id))),
    deps.groups.forUser(userId),
    deps.games.list({ userId }, 10_000),
    deps.loans.forUser(userId, true),
    deps.comments.byAuthor(userId),
    deps.blocks.blocked(userId),
  ]);
  const member = (m: { username: string | null; name: string } | null) =>
    m ? (m.username ? `@${m.username}` : m.name) : null;
  const people = new Map<string, string | null>();
  for (const id of new Set([
    ...following,
    ...proposals.flatMap((p) => [p.fromUserId, p.toUserId]),
  ])) {
    people.set(id, (await deps.profiles.byId(id))?.username ?? null);
  }
  const who = (id: string) => (id === userId ? "yo" : (people.get(id) ?? "(cuenta borrada)"));
  return {
    exportedAt: now.toISOString(),
    profile: profile && {
      username: profile.username,
      name: profile.name,
      email,
      collectionPublic: profile.collectionPublic,
      tradesPublic: profile.tradesPublic,
      createdAt: profile.createdAt.toISOString(),
      priceAlertPercent: await deps.profiles.priceAlertPercent(userId),
    },
    collection: entries.map((e) => ({
      id: e.id,
      oracleId: e.oracleId,
      name: e.name,
      quantity: e.quantity,
      foil: e.foil,
      scryfallId: e.scryfallId,
      setCode: e.setCode,
      collectorNumber: e.collectorNumber,
      language: e.language,
      condition: e.condition,
      source: e.source,
      addedAt: e.addedAt.toISOString(),
    })),
    decks: decks.flatMap((d) =>
      d
        ? [
            {
              id: d.id,
              name: d.name,
              commanders: d.commanderNames,
              visibility: d.visibility,
              theme: d.theme,
              targetBracket: d.targetBracket,
              list: d.input,
              locked: d.locked,
              excluded: d.excluded,
              updatedAt: d.updatedAt.toISOString(),
            },
          ]
        : [],
    ),
    wishlist: wishes,
    keep: [...keeps],
    roleCorrections: [...roles].map(([oracleId, e]) => ({
      oracleId,
      roles: e.override?.roles ?? [],
      primary: e.override?.primary ?? null,
      tags: e.tags,
    })),
    tradeProposals: proposals.map((p) => ({
      id: p.id,
      from: who(p.fromUserId),
      to: who(p.toUserId),
      status: p.status,
      version: p.version,
      items: p.items.map(({ giverId, ...i }) => ({ ...i, gives: who(giverId) })),
      createdAt: p.createdAt.toISOString(),
    })),
    following: following.map((id) => people.get(id)).filter((u): u is string => Boolean(u)),
    blocked: blocked.flatMap((b) => (b.username ? [b.username] : [])),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      owner: g.ownerId === userId,
    })),
    games: games.map((g) => ({
      id: g.id,
      group: g.group?.name ?? null,
      playedAt: g.playedAt.toISOString(),
      turns: g.turns,
      notes: g.notes,
      players: g.players.map((p) => ({
        player: p.userId === userId ? "yo" : (member(p.user) ?? p.guestName),
        deck: p.deckName,
        winner: p.winner,
      })),
    })),
    loans: [...loans.lent, ...loans.borrowed].map((l) => ({
      id: l.id,
      card: l.name,
      quantity: l.quantity,
      from: l.lenderId === userId ? "yo" : member(l.lender),
      to: l.borrower?.id === userId ? "yo" : (member(l.borrower) ?? l.borrowerName),
      note: l.note,
      createdAt: l.createdAt.toISOString(),
      returnedAt: l.returnedAt?.toISOString() ?? null,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      deck: c.deckId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
