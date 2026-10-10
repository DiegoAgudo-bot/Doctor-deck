import type { Card } from "../cards/types";
import { ROLES, type Role, type RoleClassifier, type RoleSet } from "./types";

/** Roles puestos a mano (o por las etiquetas de la lista) en vez de los automáticos. */
export interface RoleOverride {
  roles: Role[];
  primary: Role;
}

/** De dónde salen los roles de una carta. */
export type RoleSource = "auto" | "list" | "mine";

/** Normaliza: roles válidos sin repetir (en el orden de ROLES) y un principal que esté entre ellos. */
export function normalizeOverride(
  roles: readonly string[],
  primary?: string | null,
): RoleOverride | null {
  const valid = ROLES.filter((r) => roles.includes(r));
  if (valid.length === 0) return null;
  const p = valid.find((r) => r === primary) ?? valid[0]!;
  return { roles: valid, primary: p };
}

/**
 * Clasificador que respeta correcciones: primero las mías, después las de la lista del mazo y,
 * si no hay ninguna, el automático. `sourceOf` dice cuál se usó para cada carta.
 */
export function withOverrides(
  base: RoleClassifier,
  layers: { mine?: ReadonlyMap<string, RoleOverride>; list?: ReadonlyMap<string, RoleOverride> },
): RoleClassifier & { sourceOf(card: Card): RoleSource } {
  const find = (card: Card): [RoleOverride, RoleSource] | null => {
    const mine = layers.mine?.get(card.oracleId);
    if (mine) return [mine, "mine"];
    const list = layers.list?.get(card.oracleId);
    return list ? [list, "list"] : null;
  };
  return {
    classify(card: Card): RoleSet {
      const o = find(card);
      return o ? { roles: [...o[0].roles], primary: o[0].primary } : base.classify(card);
    },
    sourceOf: (card) => find(card)?.[1] ?? "auto",
  };
}
