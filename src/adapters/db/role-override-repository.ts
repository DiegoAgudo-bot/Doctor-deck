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
    return new Map(rows.map((r): [string, CardRoleEdit] => [r.oracleId, toEdit(r)]));
  }

  async set(oracleId: string, edit: CardRoleEdit) {
    const key = { userId_oracleId: { userId: this.userId, oracleId } };
    if (!edit.override && edit.tags.length === 0) {
      await this.db.cardRoleOverride.deleteMany({ where: key.userId_oracleId });
      return;
    }
    const data = toRow(edit);
    await this.db.cardRoleOverride.upsert({
      where: key,
      create: { ...key.userId_oracleId, ...data },
      update: data,
    });
  }

  async forDeck(deckId: string) {
    const rows = await this.db.deckRoleOverride.findMany({
      where: { deck: { publicId: deckId, userId: this.userId } },
    });
    return new Map(rows.map((r): [string, CardRoleEdit] => [r.oracleId, toEdit(r)]));
  }

  async setForDeck(deckId: string, oracleId: string, edit: CardRoleEdit) {
    const deck = await this.db.deck.findFirst({
      where: { publicId: deckId, userId: this.userId },
      select: { id: true },
    });
    if (!deck) return false;
    const key = { deckId_oracleId: { deckId: deck.id, oracleId } };
    if (!edit.override && edit.tags.length === 0) {
      await this.db.deckRoleOverride.deleteMany({ where: key.deckId_oracleId });
      return true;
    }
    const data = toRow(edit);
    await this.db.deckRoleOverride.upsert({
      where: key,
      create: { ...key.deckId_oracleId, ...data },
      update: data,
    });
    return true;
  }
}

const toEdit = (r: { roles: string; primary: string | null; tags: string }): CardRoleEdit => ({
  override: normalizeOverride(parse(r.roles), r.primary),
  tags: parse(r.tags),
});

const toRow = (edit: CardRoleEdit) => ({
  roles: JSON.stringify(edit.override?.roles ?? []),
  primary: edit.override?.primary ?? null,
  tags: JSON.stringify(edit.tags),
});
