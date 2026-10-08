import { frontFace } from "@/domain/cards/names";

/**
 * Slug de EDHREC para un nombre de carta: "Atraxa, Praetors' Voice" → "atraxa-praetors-voice".
 * En cartas de dos caras se usa la cara frontal.
 */
export function edhrecSlug(name: string): string {
  return frontFace(name)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug de la página de comandante. Las parejas (partners, backgrounds…) se unen con "-" en orden
 * alfabético, que es como EDHREC nombra esas páginas.
 */
export function commanderSlug(commanders: readonly string[]): string {
  if (commanders.length === 0) throw new Error("Hace falta al menos un comandante");
  return commanders.map(edhrecSlug).sort().join("-");
}

/** Slug de tema válido: solo minúsculas, números y guiones. */
export function isValidThemeSlug(theme: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme);
}
