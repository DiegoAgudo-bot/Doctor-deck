import { isPrefKey, type PrefKey } from "@/domain/prefs/prefs";
import type { PrefsRepository } from "@/domain/ports/prefs";
import type { Db } from "./prisma";

export class PrismaPrefsRepository implements PrefsRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async all() {
    const rows = await this.db.userPref.findMany({ where: { userId: this.userId } });
    const out: Partial<Record<PrefKey, Record<string, unknown>>> = {};
    for (const r of rows) {
      if (!isPrefKey(r.key)) continue;
      try {
        out[r.key] = JSON.parse(r.value) as Record<string, unknown>;
      } catch {
        /* una fila rota no impide leer las demás */
      }
    }
    return out;
  }

  async set(key: PrefKey, value: Record<string, unknown>) {
    const json = JSON.stringify(value);
    await this.db.userPref.upsert({
      where: { userId_key: { userId: this.userId, key } },
      create: { userId: this.userId, key, value: json },
      update: { value: json },
    });
  }
}
