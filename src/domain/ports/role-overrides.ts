import type { RoleOverride } from "../roles/overrides";

/** Lo que un usuario ha corregido de una carta: roles (opcional) y etiquetas libres. */
export interface CardRoleEdit {
  /** null = usar los roles automáticos (o los de la lista). */
  override: RoleOverride | null;
  tags: string[];
}

/** Correcciones de roles de UN usuario (se crea por usuario, como colección y mazos). */
export interface RoleOverrideRepository {
  all(): Promise<Map<string, CardRoleEdit>>;
  /** Guarda (o, sin roles ni etiquetas, borra) la corrección de una carta. */
  set(oracleId: string, edit: CardRoleEdit): Promise<void>;
  /** Las correcciones que valen solo en uno de MIS mazos (por su id público); vacío si no es mío. */
  forDeck(deckId: string): Promise<Map<string, CardRoleEdit>>;
  /**
   * Guarda (o, vacía, borra) la corrección de una carta solo para uno de mis mazos. Devuelve false
   * si el mazo no existe o no es mío.
   */
  setForDeck(deckId: string, oracleId: string, edit: CardRoleEdit): Promise<boolean>;
}
