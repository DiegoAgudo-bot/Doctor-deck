import { ROLES, type Role } from "./types";

/** Nombre de cada rol como etiqueta de Moxfield (`#!Ramp`); sin espacios. */
export const ROLE_TAGS: Record<Role, string> = {
  land: "Land",
  ramp: "Ramp",
  draw: "Draw",
  removal: "Removal",
  wipe: "Wipe",
  counterspell: "Counterspell",
  tutor: "Tutor",
  protection: "Protection",
  synergy: "Synergy",
};

/** Alias habituales (en inglés y en español, sin tildes ni espacios) de cada rol. */
const ALIASES: Record<string, Role> = {
  land: "land",
  lands: "land",
  tierra: "land",
  tierras: "land",
  ramp: "ramp",
  manaramp: "ramp",
  rampa: "ramp",
  manarocks: "ramp",
  manadorks: "ramp",
  draw: "draw",
  carddraw: "draw",
  cardadvantage: "draw",
  robo: "draw",
  removal: "removal",
  spotremoval: "removal",
  targetedremoval: "removal",
  interaction: "removal",
  wipe: "wipe",
  wipes: "wipe",
  boardwipe: "wipe",
  boardwipes: "wipe",
  sweeper: "wipe",
  wrath: "wipe",
  counterspell: "counterspell",
  counterspells: "counterspell",
  counter: "counterspell",
  contrahechizo: "counterspell",
  tutor: "tutor",
  tutors: "tutor",
  protection: "protection",
  proteccion: "protection",
  synergy: "synergy",
  sinergia: "synergy",
};

const key = (tag: string) =>
  tag
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** El rol al que corresponde una etiqueta ("Board Wipe", "#!ramp", "Robo"…), o null. */
export const roleFromTag = (tag: string): Role | null => ALIASES[key(tag)] ?? null;

/** Separa las etiquetas en roles (en el orden de ROLES) y etiquetas libres (sin repetir). */
export function splitTags(tags: readonly string[]): { roles: Role[]; free: string[] } {
  const roles = new Set<Role>();
  const free: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const role = roleFromTag(tag);
    if (role) roles.add(role);
    else if (!free.some((f) => key(f) === key(tag))) free.push(tag);
  }
  return { roles: ROLES.filter((r) => roles.has(r)), free };
}
