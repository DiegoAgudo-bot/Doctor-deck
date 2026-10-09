import type {
  CollectionEntryRow,
  CollectionRepository,
  ManualCard,
  StoredCollection,
} from "@/domain/ports/collection-repository";
import type { Db } from "./prisma";

/** `matchMethod` de las cartas añadidas sueltas: sobreviven a reimportar el CSV. */
export const MANUAL = "manual";

/** Colección de UN usuario: todas las consultas se filtran por `userId`. */
export class PrismaCollectionRepository implements CollectionRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async replaceCollection({ matched, unmatched }: StoredCollection) {
    const data = [
      ...matched.map((m) => ({
        scryfallId: m.scryfallId,
        oracleId: m.oracleId,
        status: "matched",
        matchMethod: m.method,
        row: m.row,
      })),
      ...unmatched.map((row) => ({
        scryfallId: row.scryfallId,
        oracleId: null,
        status: "unmatched",
        matchMethod: null,
        row,
      })),
    ].map(({ row, ...rest }) => ({
      ...rest,
      userId: this.userId,
      name: row.name,
      setCode: row.setCode,
      collectorNumber: row.collectorNumber,
      quantity: row.quantity,
      foil: row.foil,
      line: row.line,
      raw: JSON.stringify(row.raw),
    }));

    await this.db.$transaction(async (tx) => {
      // Reimportar reemplaza lo que vino del CSV, no lo añadido a mano.
      await tx.collectionEntry.deleteMany({
        where: {
          userId: this.userId,
          OR: [{ matchMethod: null }, { matchMethod: { not: MANUAL } }],
        },
      });
      for (let i = 0; i < data.length; i += 500) {
        await tx.collectionEntry.createMany({ data: data.slice(i, i + 500) });
      }
    });
  }

  async addCards(cards: readonly ManualCard[]) {
    if (cards.length === 0) return;
    await this.db.collectionEntry.createMany({
      data: cards.map((c) => ({
        userId: this.userId,
        oracleId: c.oracleId,
        scryfallId: c.scryfallId ?? null,
        name: c.name,
        quantity: c.quantity,
        foil: c.foil,
        status: "matched",
        matchMethod: MANUAL,
        line: 0,
        raw: "{}",
      })),
    });
  }

  async entries(): Promise<CollectionEntryRow[]> {
    const rows = await this.db.collectionEntry.findMany({
      where: { userId: this.userId, status: "matched", oracleId: { not: null } },
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        oracleId: true,
        name: true,
        quantity: true,
        foil: true,
        setCode: true,
        matchMethod: true,
        importedAt: true,
      },
    });
    return rows.flatMap((r) =>
      r.oracleId
        ? [
            {
              id: String(r.id),
              oracleId: r.oracleId,
              name: r.name,
              quantity: r.quantity,
              foil: r.foil,
              setCode: r.setCode,
              source: r.matchMethod === MANUAL ? ("manual" as const) : ("csv" as const),
              addedAt: r.importedAt,
            },
          ]
        : [],
    );
  }

  async removeAdded(id: string) {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return false;
    const { count } = await this.db.collectionEntry.deleteMany({
      where: { id: n, userId: this.userId, matchMethod: MANUAL },
    });
    return count > 0;
  }

  async summary() {
    const [rows, total, unique, unmatched, last] = await Promise.all([
      this.db.collectionEntry.count({ where: { userId: this.userId } }),
      // Copias identificadas (las que cuentan al analizar); las filas sin emparejar van aparte.
      this.db.collectionEntry.aggregate({
        where: { userId: this.userId, status: "matched" },
        _sum: { quantity: true },
      }),
      this.db.collectionEntry.findMany({
        where: { userId: this.userId, status: "matched" },
        distinct: ["oracleId"],
        select: { oracleId: true },
      }),
      this.db.collectionEntry.count({ where: { userId: this.userId, status: "unmatched" } }),
      this.db.collectionEntry.findFirst({
        where: { userId: this.userId },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true },
      }),
    ]);
    return {
      rows,
      totalCards: total._sum.quantity ?? 0,
      uniqueCards: unique.length,
      unmatchedRows: unmatched,
      importedAt: last?.importedAt ?? null,
    };
  }

  async ownedQuantities() {
    const groups = await this.db.collectionEntry.groupBy({
      by: ["oracleId"],
      where: { userId: this.userId, status: "matched", oracleId: { not: null } },
      _sum: { quantity: true },
    });
    return new Map(
      groups.flatMap((g) => (g.oracleId ? [[g.oracleId, g._sum.quantity ?? 0] as const] : [])),
    );
  }
}
