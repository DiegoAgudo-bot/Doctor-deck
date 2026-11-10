import type { DeckViewDTO } from "@/server/dto";
import { t } from "./i18n";

/**
 * Una lista para analizar sin guardarla (como el analizador de la web): vive solo en memoria y la
 * pantalla del mazo la abre con el id `draft`, como si fuera el mazo de otro (se mira, se le
 * cambia el tema y, si convence, «Guardar una copia» lo crea de verdad).
 */
export const DRAFT_ID = "draft";

let draft: { input: string; name: string; at: string } | null = null;

export function setDraftDeck(input: string, name: string) {
  draft = { input, name, at: new Date().toISOString() };
}

/** El nombre que se escribió (para guardarlo); sin él, el servidor propone uno. */
export const draftName = () => draft?.name.trim() || null;

/** El borrador como un mazo que no es mío; null si no hay (p. ej. al reabrir la app). */
export function draftDeck(): DeckViewDTO | null {
  if (!draft) return null;
  return {
    id: DRAFT_ID,
    name: draft.name.trim() || t("Lista sin guardar", "Unsaved list"),
    source: "text",
    commanderNames: [],
    commanders: [],
    cardCount: 0,
    updatedAt: draft.at,
    visibility: "private",
    inWishlist: false,
    input: draft.input,
    targetBracket: null,
    theme: null,
    locked: [],
    excluded: [],
    isMine: false,
    owner: { username: null, name: "" },
    likes: 0,
    liked: false,
  };
}
