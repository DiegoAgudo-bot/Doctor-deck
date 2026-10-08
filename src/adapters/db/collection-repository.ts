import type { CollectionRepository, StoredCollection } from "@/domain/ports/collection-repository";
import type { Db } from "./prisma";

export class PrismaCollectionRepository implements CollectionRepository {
  constructor(private readonly db: Db) {}

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
      name: row.name,
      setCode: row.setCode,
      collectorNumber: row.collectorNumber,
      quantity: row.quantity,
      foil: row.foil,
      line: row.line,
      raw: JSON.stringify(row.raw),
    }));

    await this.db.$transaction(async (tx) => {
      await tx.collectionEntry.deleteMany();
      for (let i = 0; i < data.length; i += 500) {
        await tx.collectionEntry.createMany({ data: data.slice(i, i + 500) });
      }
    });
  }

  async summary() {
    const [rows, total, unique, unmatched, last] = await Promise.all([
      this.db.collectionEntry.count(),
      this.db.collectionEntry.aggregate({ _sum: { quantity: true } }),
      this.db.collectionEntry.findMany({
        where: { status: "matched" },
        distinct: ["oracleId"],
        select: { oracleId: true },
      }),
      this.db.collectionEntry.count({ where: { status: "unmatched" } }),
      this.db.collectionEntry.findFirst({
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
      where: { status: "matched", oracleId: { not: null } },
      _sum: { quantity: true },
    });
    return new Map(
      groups.flatMap((g) => (g.oracleId ? [[g.oracleId, g._sum.quantity ?? 0] as const] : [])),
    );
  }
}
