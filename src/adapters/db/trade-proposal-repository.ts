import {
  MissingCopiesError,
  PROPOSAL_STATUSES,
  ProposalNotPendingError,
  type NewProposal,
  type ProposalItem,
  type ProposalStatus,
  type TradeProposal,
  type TradeProposalRepository,
} from "@/domain/ports/trade-proposals";
import { copyKey } from "@/domain/trades/proposal";
import type { Prisma } from "@/generated/prisma/client";
import { MANUAL } from "./collection-repository";
import type { Db } from "./prisma";

type Row = Prisma.TradeProposalGetPayload<{ include: { items: true } }>;
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

const toProposal = (r: Row): TradeProposal => ({
  id: r.publicId,
  fromUserId: r.fromUserId,
  toUserId: r.toUserId,
  status: PROPOSAL_STATUSES.find((s) => s === r.status) ?? "draft",
  turnUserId: r.turnUserId,
  version: r.version,
  lastById: r.lastById,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  closedAt: r.closedAt,
  items: r.items
    .filter((i) => i.version === r.version)
    .map((i) => ({
      giverId: i.giverId,
      oracleId: i.oracleId,
      scryfallId: i.scryfallId,
      foil: i.foil,
      language: i.language,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
});

const itemRows = (items: readonly ProposalItem[], version: number) =>
  items.map((i) => ({
    version,
    giverId: i.giverId,
    oracleId: i.oracleId,
    scryfallId: i.scryfallId?.toLowerCase() ?? null,
    foil: i.foil,
    language: i.language,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

/** Solo las líneas de la versión actual (las demás son historial). */
const currentItems = { items: { orderBy: { id: "asc" as const } } };

export class PrismaTradeProposalRepository implements TradeProposalRepository {
  constructor(private readonly db: Db) {}

  async create(p: NewProposal) {
    const row = await this.db.tradeProposal.create({
      data: {
        fromUserId: p.fromUserId,
        toUserId: p.toUserId,
        status: p.status,
        turnUserId: p.turnUserId,
        lastById: p.fromUserId,
        items: { create: itemRows(p.items, 1) },
      },
    });
    return row.publicId;
  }

  async get(id: string) {
    const row = await this.db.tradeProposal.findUnique({
      where: { publicId: id },
      include: currentItems,
    });
    return row ? toProposal(row) : null;
  }

  async listFor(userId: string) {
    const rows = await this.db.tradeProposal.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId, status: { not: "draft" } }],
      },
      orderBy: { updatedAt: "desc" },
      include: currentItems,
    });
    return rows.map(toProposal);
  }

  async openBetween(userId: string, otherId: string) {
    const row = await this.db.tradeProposal.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherId, status: { in: ["draft", "pending"] } },
          { fromUserId: otherId, toUserId: userId, status: "pending" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: currentItems,
    });
    return row ? toProposal(row) : null;
  }

  async update(
    id: string,
    data: {
      items?: readonly ProposalItem[] | undefined;
      newVersion?: boolean | undefined;
      byUserId: string;
      status: ProposalStatus;
      turnUserId: string | null;
    },
  ) {
    await this.db.$transaction(async (tx) => {
      const row = await tx.tradeProposal.findUniqueOrThrow({ where: { publicId: id } });
      const version = data.newVersion ? row.version + 1 : row.version;
      if (data.items) {
        if (!data.newVersion) {
          await tx.tradeProposalItem.deleteMany({ where: { proposalId: row.id, version } });
        }
        await tx.tradeProposalItem.createMany({
          data: itemRows(data.items, version).map((i) => ({ ...i, proposalId: row.id })),
        });
      }
      const closed = ["accepted", "rejected", "cancelled"].includes(data.status);
      await tx.tradeProposal.update({
        where: { id: row.id },
        data: {
          status: data.status,
          turnUserId: data.turnUserId,
          version,
          lastById: data.items ? data.byUserId : row.lastById,
          closedAt: closed ? new Date() : null,
        },
      });
    });
  }

  async accept(id: string) {
    await this.db.$transaction(async (tx) => {
      // Se marca aceptada solo si sigue pendiente, dentro de la transacción: con un doble clic o
      // desde dos dispositivos, la segunda petición no vuelve a mover las cartas.
      const claimed = await tx.tradeProposal.updateMany({
        where: { publicId: id, status: "pending" },
        data: { status: "accepted", turnUserId: null, closedAt: new Date() },
      });
      if (claimed.count === 0) throw new ProposalNotPendingError();
      const row = await tx.tradeProposal.findUniqueOrThrow({
        where: { publicId: id },
        include: currentItems,
      });
      const items = toProposal(row).items;
      const receiver = (giver: string) =>
        giver === row.fromUserId ? row.toUserId : row.fromUserId;
      const missing = new Map<string, string[]>();
      for (const item of items) {
        const taken = await takeCopies(tx, item);
        if (taken === null) {
          missing.set(item.giverId, [...(missing.get(item.giverId) ?? []), item.oracleId]);
          continue;
        }
        // Una línea por estado: la copia llega como estaba (near mint, jugada…).
        for (const [condition, quantity] of taken.conditions) {
          await tx.collectionEntry.create({
            data: {
              userId: receiver(item.giverId),
              oracleId: item.oracleId,
              scryfallId: item.scryfallId,
              name: taken.name,
              quantity,
              foil: item.foil,
              language: item.language,
              condition,
              status: "matched",
              matchMethod: MANUAL,
              line: 0,
              raw: JSON.stringify({ trade: id }),
            },
          });
        }
      }
      const [first] = missing;
      // Lanzar deshace la transacción (también el «aceptada»): o se mueve todo o nada.
      if (first) throw new MissingCopiesError(first[0], first[1]);
    });
  }

  async delete(id: string) {
    await this.db.tradeProposal.deleteMany({ where: { publicId: id, status: "draft" } });
  }
}

/**
 * Quita `item.quantity` copias de la colección de quien las da: primero las líneas de esa misma
 * copia (impresión, foil e idioma), después cualquier otra de la carta (las más recientes
 * primero). Devuelve el nombre de la carta y cuántas copias se han quitado de cada estado, o
 * null si no hay copias suficientes.
 */
async function takeCopies(
  tx: Tx,
  item: ProposalItem,
): Promise<{ name: string; conditions: Map<string | null, number> } | null> {
  const rows = await tx.collectionEntry.findMany({
    where: { userId: item.giverId, oracleId: item.oracleId, status: "matched" },
    orderBy: [{ importedAt: "desc" }, { id: "desc" }],
  });
  const key = copyKey(item);
  const ordered = [
    ...rows.filter((r) => copyKey({ ...r, oracleId: item.oracleId }) === key),
    ...rows.filter((r) => copyKey({ ...r, oracleId: item.oracleId }) !== key),
  ];
  if (ordered.reduce((n, r) => n + r.quantity, 0) < item.quantity) return null;
  let left = item.quantity;
  const conditions = new Map<string | null, number>();
  for (const r of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, r.quantity);
    conditions.set(r.condition, (conditions.get(r.condition) ?? 0) + take);
    if (take === r.quantity) await tx.collectionEntry.delete({ where: { id: r.id } });
    else
      await tx.collectionEntry.update({
        where: { id: r.id },
        data: { quantity: r.quantity - take },
      });
    left -= take;
  }
  return { name: ordered[0]?.name ?? item.oracleId, conditions };
}
