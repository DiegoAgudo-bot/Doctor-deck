import type { Card } from "../cards/types";
import { PRIMARY_ORDER } from "./heuristic-classifier";
import { ROLES, type Role, type RoleClassifier, type RoleSet } from "./types";

/**
 * Etiquetas de Scryfall Tagger (`otag:`) que sincronizamos y el rol que dan. Son la segunda
 * fuente de roles: se suman a los de las heurísticas (no los quitan). Protección no tiene una
 * etiqueta equivalente clara y se queda solo con las heurísticas.
 */
export const OTAG_ROLES: Readonly<Record<string, Exclude<Role, "land" | "synergy">>> = {
  ramp: "ramp",
  draw: "draw",
  removal: "removal",
  "board-wipe": "wipe",
  counterspell: "counterspell",
  tutor: "tutor",
};

export const OTAGS = Object.keys(OTAG_ROLES);

/**
 * Clasificador que añade a `base` los roles de las etiquetas de Tagger de la carta. Las tierras
 * se quedan como están (Tagger marca como "ramp" tierras como Ancient Tomb y eso inflaría el
 * recuento de ramp). Si suma algún rol, "synergy" deja de contar.
 */
export function withTaggerRoles(
  base: RoleClassifier,
  tagRoles: Readonly<Record<string, Role>> = OTAG_ROLES,
): RoleClassifier {
  return {
    classify(card: Card): RoleSet {
      const set = base.classify(card);
      if (!card.otags || card.otags.length === 0 || set.roles.includes("land")) return set;
      const found = new Set<Role>(set.roles);
      for (const tag of card.otags) {
        const role = tagRoles[tag];
        if (role) found.add(role);
      }
      if (found.size === set.roles.length) return set;
      found.delete("synergy");
      const roles = ROLES.filter((r) => found.has(r));
      // El principal de las heurísticas se mantiene salvo que fuera "synergy".
      const primary =
        set.primary !== "synergy"
          ? set.primary
          : (PRIMARY_ORDER.find((r) => found.has(r)) ?? "synergy");
      return { roles, primary };
    },
  };
}
