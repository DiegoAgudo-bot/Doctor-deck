import type { CardRoleEdit, RoleOverrideRepository } from "@/domain/ports/role-overrides";
import { normalizeOverride } from "@/domain/roles/overrides";
import type { Db } from "./prisma";

const parse = (json: string): string[] => {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Correcciones de roles de un usuario (tabla `CardRoleOverride`). */
export class PrismaRoleOverrideRepository implements RoleOverrideRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async all() {
    const rows = await this.db.cardRoleOverride.findMany({ where: { userId: this.userId } });
    return new Map(
      rows.map((r): [string, CardRoleEdit] => [
        r.oracleId,
        { override: normalizeOverride(parse(r.roles), r.primary), tags: parse(r.tags) },
      ]),
    );
  }

  async set(oracleId: string, edit: CardRoleEdit) {
    const key = { userId_oracleId: { userId: this.userId, oracleId } };
    if (!edit.override && edit.tags.length === 0) {
      await this.db.cardRoleOverride.deleteMany({ where: key.userId_oracleId });
      return;
    }
    const data = {
      roles: JSON.stringify(edit.override?.roles ?? []),
      primary: edit.override?.primary ?? null,
      tags: JSON.stringify(edit.tags),
    };
    await this.db.cardRoleOverride.upsert({
      where: key,
      create: { ...key.userId_oracleId, ...data },
      update: data,
    });
  }
}
