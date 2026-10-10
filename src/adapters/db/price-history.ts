import type { PriceHistory } from "@/domain/ports/price-history";
import type { Db } from "./prisma";

/** Histórico de precios en la tabla `PriceSnapshot` (global: los precios son de todos). */
export class PrismaPriceHistory implements PriceHistory {
  constructor(private readonly db: Db) {}

  async recordSnapshot(date: string): Promise<number> {
    // Solo las cartas que le interesan a alguien, para no guardar ~30 000 filas al día.
    return this.db.$executeRaw`
      INSERT INTO "PriceSnapshot" ("oracleId", "date", "eur")
      SELECT p."oracleId", ${date}, MIN(p."priceEur")
      FROM "Printing" p
      WHERE p."priceEur" IS NOT NULL
        AND p."oracleId" IN (
          SELECT "oracleId" FROM "CollectionEntry" WHERE "oracleId" IS NOT NULL
          UNION
          SELECT "oracleId" FROM "DeckCard"
        )
      GROUP BY p."oracleId"
      ON CONFLICT ("oracleId", "date") DO UPDATE SET "eur" = excluded."eur"`;
  }

  async historyMany(oracleIds: readonly string[], since: string) {
    const result = new Map<string, { date: string; eur: number }[]>();
    const ids = [...new Set(oracleIds)];
    for (let i = 0; i < ids.length; i += 500) {
      const rows = await this.db.priceSnapshot.findMany({
        where: { oracleId: { in: ids.slice(i, i + 500) }, date: { gte: since } },
        orderBy: { date: "asc" },
      });
      for (const r of rows) {
        const list = result.get(r.oracleId) ?? [];
        list.push({ date: r.date, eur: r.eur });
        result.set(r.oracleId, list);
      }
    }
    return result;
  }

  async latestDate() {
    return (
      (await this.db.priceSnapshot.findFirst({ orderBy: { date: "desc" }, select: { date: true } }))
        ?.date ?? null
    );
  }

  async history(oracleId: string, since?: string) {
    return this.db.priceSnapshot.findMany({
      where: { oracleId, ...(since === undefined ? {} : { date: { gte: since } }) },
      orderBy: { date: "asc" },
      select: { date: true, eur: true },
    });
  }
}
