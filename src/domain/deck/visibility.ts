/**
 * Quién ve un mazo guardado:
 * - `public`: sale en tu perfil y en Comunidad, y avisa a quien te sigue al crearlo.
 * - `unlisted` (oculto): solo quien tenga el enlace; no sale en ningún listado ni avisa.
 * - `private`: solo tú.
 */
export const DECK_VISIBILITIES = ["public", "unlisted", "private"] as const;
export type DeckVisibility = (typeof DECK_VISIBILITIES)[number];

export const isDeckVisibility = (v: unknown): v is DeckVisibility =>
  typeof v === "string" && (DECK_VISIBILITIES as readonly string[]).includes(v);

/** Lo que llega de la BD: cualquier valor desconocido se trata como privado. */
export const toDeckVisibility = (v: string): DeckVisibility =>
  isDeckVisibility(v) ? v : "private";

/** ¿Puede `viewerId` abrir el mazo de `ownerId` por su enlace? */
export const canOpenDeck = (
  visibility: DeckVisibility,
  ownerId: string,
  viewerId: string | null,
): boolean => visibility !== "private" || ownerId === viewerId;

/** ¿Sale en el perfil, en Comunidad y en los avisos? */
export const isListedDeck = (visibility: DeckVisibility): boolean => visibility === "public";
