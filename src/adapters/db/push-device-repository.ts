import type { PushDeviceRepository, PushPlatform } from "@/domain/ports/push";
import type { Db } from "./prisma";

export class PrismaPushDeviceRepository implements PushDeviceRepository {
  constructor(private readonly db: Db) {}

  async register(
    userId: string,
    device: { token: string; platform: PushPlatform; appVersion: string | null },
  ) {
    await this.db.pushDevice.upsert({
      where: { token: device.token },
      create: { userId, ...device },
      update: {
        userId,
        platform: device.platform,
        appVersion: device.appVersion,
        lastSeenAt: new Date(),
      },
    });
  }

  async unregister(userId: string, token: string) {
    await this.db.pushDevice.deleteMany({ where: { userId, token } });
  }

  async tokensFor(userIds: readonly string[]) {
    if (userIds.length === 0) return [];
    return this.db.pushDevice.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, token: true },
    });
  }

  async remove(tokens: readonly string[]) {
    if (tokens.length === 0) return;
    await this.db.pushDevice.deleteMany({ where: { token: { in: [...tokens] } } });
  }

  async labels(userIds: readonly string[]) {
    const users = await this.db.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, username: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.username ? `@${u.username}` : u.name]));
  }
}
