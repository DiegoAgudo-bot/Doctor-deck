import { COLORS, type Color } from "../cards/types";

/** Nombres habituales (en la comunidad hispana se usan los ingleses) de cada combinación. */
const COMBOS: Record<string, string> = {
  "": "Incoloro",
  W: "Mono blanco",
  U: "Mono azul",
  B: "Mono negro",
  R: "Mono rojo",
  G: "Mono verde",
  WU: "Azorius",
  UB: "Dimir",
  BR: "Rakdos",
  RG: "Gruul",
  WG: "Selesnya",
  WB: "Orzhov",
  UR: "Izzet",
  BG: "Golgari",
  WR: "Boros",
  UG: "Simic",
  WUG: "Bant",
  WUB: "Esper",
  UBR: "Grixis",
  BRG: "Jund",
  WRG: "Naya",
  WBG: "Abzan",
  WUR: "Jeskai",
  UBG: "Sultai",
  WBR: "Mardu",
  URG: "Temur",
  UBRG: "Glint-Eye",
  WBRG: "Dune-Brood",
  WURG: "Ink-Treader",
  WUBG: "Witch-Maw",
  WUBR: "Yore-Tiller",
  WUBRG: "Cinco colores",
};

/** Nombre de una identidad de color: "Boros", "Jund", "Mono azul"… */
export function colorGroupName(identity: readonly Color[]): string {
  const key = COLORS.filter((c) => identity.includes(c)).join("");
  return COMBOS[key] ?? key;
}

/** Temas de EDHREC más comunes, en español (los demás se dejan como vienen). */
const THEMES: Record<string, string> = {
  aggro: "Agresivo",
  aristocrats: "Aristócratas",
  artifacts: "Artefactos",
  auras: "Auras",
  "big mana": "Maná a lo grande",
  blink: "Parpadeo",
  burn: "Daño directo",
  cascade: "Cascada",
  clones: "Clones",
  combo: "Combo",
  control: "Control",
  "+1/+1 counters": "Contadores +1/+1",
  counters: "Contadores",
  discard: "Descarte",
  dragons: "Dragones",
  "draw-go": "Draw-go",
  elves: "Elfos",
  enchantress: "Encantamientos",
  enchantments: "Encantamientos",
  equipment: "Equipos",
  "extra combats": "Combates extra",
  "extra turns": "Turnos extra",
  flying: "Voladores",
  goblins: "Goblins",
  graveyard: "Cementerio",
  "group hug": "Group hug",
  humans: "Humanos",
  infect: "Infectar",
  "lands matter": "Tierras",
  landfall: "Aterrizaje",
  lifegain: "Ganar vidas",
  mill: "Molienda",
  "self-mill": "Automolienda",
  midrange: "Midrange",
  politics: "Política",
  proliferate: "Proliferar",
  ramp: "Ramp",
  reanimator: "Reanimación",
  sacrifice: "Sacrificio",
  "spell slinger": "Hechizos",
  spellslinger: "Hechizos",
  spells: "Hechizos",
  stax: "Stax",
  storm: "Tormenta",
  superfriends: "Planeswalkers",
  theft: "Robar permanentes",
  tokens: "Fichas",
  treasure: "Tesoros",
  tribal: "Tribal",
  typal: "Tribal",
  vampires: "Vampiros",
  voltron: "Voltron",
  wheels: "Ruedas",
  wizards: "Magos",
  zombies: "Zombis",
};

export const themeLabel = (name: string) => THEMES[name.trim().toLowerCase()] ?? name.trim();

/**
 * Nombre para un mazo nuevo: "<colores> - <de qué va>", p. ej. "Boros - Fichas y Combates extra".
 * `themes`: los temas del mazo de más a menos importante (se usan como mucho dos); sin temas,
 * `fallback` (p. ej. el nombre corto del comandante).
 */
export function suggestedDeckName(
  identity: readonly Color[],
  themes: readonly string[],
  fallback: string,
): string {
  const labels = [...new Set(themes.map(themeLabel))].slice(0, 2);
  const about = labels.length > 0 ? labels.join(" y ") : fallback;
  return `${colorGroupName(identity)} - ${about}`;
}
