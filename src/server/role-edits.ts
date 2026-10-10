import { z } from "zod";
import type { CardRoleEdit } from "@/domain/ports/role-overrides";
import { normalizeOverride, type RoleOverride } from "@/domain/roles/overrides";
import { ROLES } from "@/domain/roles/types";
import { getContainer } from "./container";

/** Una corrección de roles tal y como llega en el cuerpo de una petición. */
export const roleEditSchema = z.object({
  roles: z.array(z.enum(ROLES)).max(ROLES.length).default([]),
  primary: z.enum(ROLES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

/** Sin sesión, el navegador manda sus correcciones: pares [oracleId, corrección]. */
export const browserRoleEditsSchema = z
  .array(z.tuple([z.string().min(1).max(64), roleEditSchema]))
  .max(5000)
  .optional();

export const toRoleEdit = (e: z.infer<typeof roleEditSchema>): CardRoleEdit => ({
  override: normalizeOverride(e.roles, e.primary),
  tags: [...new Set(e.tags)],
});

/** Mis correcciones: las de mi cuenta o, sin sesión, las que manda el navegador. */
export async function loadRoleEdits(
  userId: string | null,
  browser: z.infer<typeof browserRoleEditsSchema>,
): Promise<Map<string, CardRoleEdit>> {
  if (userId) return getContainer().roleOverridesFor(userId).all();
  return new Map((browser ?? []).map(([id, e]) => [id, toRoleEdit(e)]));
}

/** Solo los roles corregidos (para `withOverrides`). */
export const overridesOf = (edits: ReadonlyMap<string, CardRoleEdit>) =>
  new Map(
    [...edits].flatMap(([id, e]): [string, RoleOverride][] =>
      e.override ? [[id, e.override]] : [],
    ),
  );
