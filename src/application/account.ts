import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { RoleOverrideRepository } from "@/domain/ports/role-overrides";
import type { FollowRepository, ProfileRepository } from "@/domain/ports/social";
import type { TradeProposalRepository } from "@/domain/ports/trade-proposals";
import type { TradeRepository } from "@/domain/ports/trades";

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
  const decks = await Promise.all(summaries.map((d) => deps.decks.get(d.id)));
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
  };
}
