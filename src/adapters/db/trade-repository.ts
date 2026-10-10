import type { TradeRepository } from "@/domain/ports/trades";
import type { Db } from "./prisma";

/** Lista de deseos manual y cartas que no cambio de un usuario. */
export class PrismaTradeRepository implements TradeRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async wishes() {
    const rows = await this.db.wishlistItem.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ oracleId: r.oracleId, quantity: r.quantity }));
  }

  async setWish(oracleId: string, quantity: number) {
    const key = { userId: this.userId, oracleId };
    if (quantity <= 0) {
      await this.db.wishlistItem.deleteMany({ where: key });
      return;
    }
    await this.db.wishlistItem.upsert({
      where: { userId_oracleId: key },
      create: { ...key, quantity },
      update: { quantity },
    });
  }

  async keeps() {
    const rows = await this.db.tradeKeep.findMany({ where: { userId: this.userId } });
    return new Set(rows.map((r) => r.oracleId));
  }

  async setKeep(oracleId: string, keep: boolean) {
    const key = { userId: this.userId, oracleId };
    if (keep) {
      await this.db.tradeKeep.upsert({ where: { userId_oracleId: key }, create: key, update: {} });
    } else {
      await this.db.tradeKeep.deleteMany({ where: key });
    }
  }
}
