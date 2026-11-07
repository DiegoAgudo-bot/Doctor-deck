import { RARITY_LABELS, SUPERTYPE_LABELS, type Rarity, type Supertype } from "../cards/attributes";
import { CARD_TYPES, type CardType } from "../cards/catalog-search";
import { ROLE_LABELS, type Role } from "../roles/types";
import type { Locale } from "./locale";

/** Las etiquetas de siempre (en español) en inglés. */
const RARITY_EN: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  mythic: "Mythic",
  special: "Special",
  bonus: "Bonus",
};
const SUPERTYPE_EN: Record<Supertype, string> = {
  Legendary: "Legendary",
  Basic: "Basic",
  Snow: "Snow",
};
const CARD_TYPE_EN: Record<CardType, string> = {
  creature: "Creature",
  instant: "Instant",
  sorcery: "Sorcery",
  artifact: "Artifact",
  enchantment: "Enchantment",
  planeswalker: "Planeswalker",
  land: "Land",
  battle: "Battle",
};
const ROLE_EN: Record<Role, string> = {
  land: "land",
  ramp: "ramp",
  draw: "draw",
  removal: "removal",
  wipe: "wipe",
  counterspell: "counter",
  tutor: "tutor",
  protection: "protection",
  synergy: "synergy",
};

const en = (l: Locale) => l === "en";
export const rarityLabel = (r: Rarity, l: Locale) => (en(l) ? RARITY_EN : RARITY_LABELS)[r];
export const supertypeLabel = (s: Supertype, l: Locale) =>
  (en(l) ? SUPERTYPE_EN : SUPERTYPE_LABELS)[s];
export const cardTypeLabel = (c: CardType, l: Locale) => (en(l) ? CARD_TYPE_EN : CARD_TYPES)[c];
export const roleLabel = (r: Role, l: Locale) => (en(l) ? ROLE_EN : ROLE_LABELS)[r];

/** Nombre de cada color de maná. */
export const colorName = (c: "W" | "U" | "B" | "R" | "G", l: Locale) =>
  (en(l)
    ? { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" }
    : { W: "Blanco", U: "Azul", B: "Negro", R: "Rojo", G: "Verde" })[c];
