import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository, SavedDeckSummary } from "@/domain/ports/deck-repository";
import type { Group, GroupRepository, GroupSummary, Member } from "@/domain/ports/play";
import type { NotificationRepository, ProfileRepository } from "@/domain/ports/social";
import type { TradeRepository } from "@/domain/ports/trades";
import { buildWishlist } from "@/domain/trades/lists";
import { AppError, forbidden, notFound } from "./errors";
import { ensureUsername } from "./social";

/** Un grupo de amigos, no un foro: con más gente "quién tiene qué" deja de tener sentido. */
export const MAX_GROUP_MEMBERS = 50;
export const MAX_GROUPS_PER_USER = 20;

export interface GroupDeps {
  groups: GroupRepository;
  profiles: ProfileRepository;
  notifications: NotificationRepository;
}

const cleanName = (name: string) => {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!n) throw new AppError("invalid_name", "Ponle un nombre al grupo.");
  return n;
};

export async function createGroup(
  userId: string,
  input: { name: string; description?: string | undefined },
  deps: GroupDeps,
) {
  await ensureUsername(userId, deps);
  if ((await deps.groups.forUser(userId)).length >= MAX_GROUPS_PER_USER) {
    throw new AppError("too_many_groups", `Como mucho ${MAX_GROUPS_PER_USER} grupos.`, 409);
  }
  return deps.groups.create({
    ownerId: userId,
    name: cleanName(input.name),
    description: (input.description ?? "").trim().slice(0, 300),
  });
}

/** El grupo si soy miembro; si no, como si no existiera. */
export async function memberGroup(
  groupId: string,
  viewerId: string,
  deps: Pick<GroupDeps, "groups">,
) {
  const g = await deps.groups.get(groupId);
  if (!g || !g.members.some((m) => m.id === viewerId)) throw notFound("Ese grupo no existe.");
  return g;
}

export const myGroups = (userId: string, deps: Pick<GroupDeps, "groups">) =>
  deps.groups.forUser(userId);

/** Lo que se ve al abrir un enlace de invitación (sin ser miembro aún). */
export async function invitePreview(
  code: string,
  viewerId: string | null,
  deps: Pick<GroupDeps, "groups">,
): Promise<{ group: GroupSummary; member: boolean }> {
  const g = await deps.groups.byInvite(code);
  if (!g) throw notFound("Ese enlace de invitación ya no vale. Pide uno nuevo.");
  return { group: g, member: viewerId ? await deps.groups.isMember(g.id, viewerId) : false };
}

export async function joinGroup(code: string, userId: string, deps: GroupDeps) {
  const { group, member } = await invitePreview(code, userId, deps);
  if (member) return group.id;
  if (group.members >= MAX_GROUP_MEMBERS) {
    throw new AppError("group_full", `El grupo ya tiene ${MAX_GROUP_MEMBERS} miembros.`, 409);
  }
  const me = await ensureUsername(userId, deps);
  await deps.groups.join(group.id, userId);
  await deps.notifications.create([
    {
      userId: group.ownerId,
      actorId: me.id,
      type: "group_join",
      title: group.name,
      refId: group.id,
    },
  ]);
  return group.id;
}

export async function updateGroup(
  groupId: string,
  viewerId: string,
  changes: { name?: string | undefined; description?: string | undefined },
  deps: Pick<GroupDeps, "groups">,
) {
  const g = await memberGroup(groupId, viewerId, deps);
  if (g.ownerId !== viewerId) throw forbidden("Solo quien creó el grupo puede cambiarlo.");
  await deps.groups.update(groupId, {
    ...(changes.name !== undefined ? { name: cleanName(changes.name) } : {}),
    ...(changes.description !== undefined
      ? { description: changes.description.trim().slice(0, 300) }
      : {}),
  });
}

export async function newInvite(
  groupId: string,
  viewerId: string,
  deps: Pick<GroupDeps, "groups">,
) {
  const g = await memberGroup(groupId, viewerId, deps);
  if (g.ownerId !== viewerId) throw forbidden("Solo quien creó el grupo puede cambiar el enlace.");
  return deps.groups.newInvite(groupId);
}

/** Salir del grupo, o (el dueño) echar a alguien. El dueño no sale: borra el grupo. */
export async function removeMember(
  groupId: string,
  viewerId: string,
  memberId: string,
  deps: Pick<GroupDeps, "groups">,
) {
  const g = await memberGroup(groupId, viewerId, deps);
  if (memberId === g.ownerId) {
    throw new AppError("owner_leaves", "Quien creó el grupo no puede salir: puede borrarlo.", 409);
  }
  if (memberId !== viewerId && g.ownerId !== viewerId) throw forbidden();
  await deps.groups.removeMember(groupId, memberId);
}

export async function deleteGroup(
  groupId: string,
  viewerId: string,
  deps: Pick<GroupDeps, "groups">,
) {
  const g = await memberGroup(groupId, viewerId, deps);
  if (g.ownerId !== viewerId) throw forbidden("Solo quien creó el grupo puede borrarlo.");
  await deps.groups.delete(groupId);
}

export interface GroupDeck extends SavedDeckSummary {
  owner: Member;
}

/** Los mazos públicos y ocultos de los miembros (los ocultos se ven dentro del grupo). */
export async function groupDecks(
  group: Group,
  deps: { decksFor: (userId: string) => DeckRepository },
): Promise<GroupDeck[]> {
  const lists = await Promise.all(
    group.members.map(async (m) =>
      (await deps.decksFor(m.id).list())
        .filter((d) => d.visibility !== "private")
        .map((d) => ({ ...d, owner: m })),
    ),
  );
  return lists.flat().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export interface CardHolder {
  member: Member;
  owned: number;
  /** Copias que no usa en sus mazos ni tiene prestadas. */
  free: number;
  /** Mazos en los que la usa (y "Prestada a…"). */
  usedIn: string[];
}

type HolderDeps = {
  collectionFor: (userId: string) => CollectionRepository;
  decksFor: (userId: string) => DeckRepository;
};

/** Quién del grupo tiene estas cartas y cuántas copias libres (para pedirlas prestadas). */
export async function groupHolders(
  group: Group,
  oracleIds: readonly string[],
  deps: HolderDeps,
): Promise<Map<string, CardHolder[]>> {
  const ids = new Set(oracleIds);
  const out = new Map<string, CardHolder[]>([...ids].map((id) => [id, []]));
  await Promise.all(
    group.members.map(async (member) => {
      const [owned, usage] = await Promise.all([
        deps.collectionFor(member.id).ownedQuantities(),
        deps.decksFor(member.id).usage(),
      ]);
      for (const id of ids) {
        const n = owned.get(id) ?? 0;
        if (n === 0) continue;
        const u = usage.get(id);
        out.get(id)!.push({
          member,
          owned: n,
          free: Math.max(0, n - (u?.quantity ?? 0)),
          usedIn: u?.decks ?? [],
        });
      }
    }),
  );
  for (const list of out.values()) list.sort((a, b) => b.free - a.free || b.owned - a.owned);
  return out;
}

/**
 * Lo que me falta (mi lista de deseos: lo añadido a mano y lo que falta en los mazos marcados, o
 * si no hay nada, lo que falta en todos mis mazos) y quién del grupo lo tiene libre.
 */
export async function groupCanLend(
  group: Group,
  viewerId: string,
  deps: HolderDeps & { tradesFor: (userId: string) => TradeRepository; cards: CardRepository },
): Promise<{ oracleId: string; wanted: number; holders: CardHolder[] }[]> {
  const decks = deps.decksFor(viewerId);
  const [owned, usage, manual, marked] = await Promise.all([
    deps.collectionFor(viewerId).ownedQuantities(),
    decks.usage(),
    deps.tradesFor(viewerId).wishes(),
    decks.wishlistDeckCards(),
  ]);
  // Sin mazos marcados, cuenta lo que falta en todos (en un grupo se presta para jugar).
  const markedDecks =
    marked.size > 0
      ? marked
      : new Map<string, number>(
          [...usage].flatMap(([id, u]) => (u.decks.length ? [[id, u.quantity] as const] : [])),
        );
  const basics = await deps.cards.findBasicLandIds([
    ...markedDecks.keys(),
    ...manual.map((m) => m.oracleId),
  ]);
  const wishlist = buildWishlist({ manual, markedDecks, usage, owned, basics });
  const others = { ...group, members: group.members.filter((m) => m.id !== viewerId) };
  const holders = await groupHolders(
    others,
    wishlist.map((w) => w.oracleId),
    deps,
  );
  return wishlist.flatMap((w) => {
    const h = (holders.get(w.oracleId) ?? []).filter((x) => x.free > 0);
    return h.length ? [{ oracleId: w.oracleId, wanted: w.quantity, holders: h }] : [];
  });
}
