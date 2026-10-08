import type { Card } from "../cards/types";

export const ROLES = [
  "land",
  "ramp",
  "draw",
  "removal",
  "wipe",
  "counterspell",
  "tutor",
  "protection",
  "synergy",
] as const;

/** Función de una carta en el mazo. "synergy" = wincon / pieza del plan (lo que no es lo demás). */
export type Role = (typeof ROLES)[number];

export interface RoleSet {
  /** Todos los roles que cumple, sin repetir. Nunca vacío. */
  roles: Role[];
  /** El rol por el que se la cuenta en primer lugar. */
  primary: Role;
}

/** Clasificador intercambiable (heurísticas hoy; etiquetas `otag:` de Scryfall más adelante). */
export interface RoleClassifier {
  classify(card: Card): RoleSet;
}

/** Nombres en español para mostrar al usuario. */
export const ROLE_LABELS: Record<Role, string> = {
  land: "tierra",
  ramp: "ramp",
  draw: "robo",
  removal: "removal",
  wipe: "wipe",
  counterspell: "counter",
  tutor: "tutor",
  protection: "protección",
  synergy: "sinergia",
};
