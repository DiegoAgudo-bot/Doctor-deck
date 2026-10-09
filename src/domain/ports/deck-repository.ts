import type { CardUsage } from "../suggestions/engine";

export interface SavedDeckSummary {
  /** Identificador público (uuid): el de las URL /decks/{id} y la API. */
  id: string;
  name: string;
  source: string;
  commanderNames: string[];
  /** oracleIds de los comandantes. */
  commanders: string[];
  cardCount: number;
  updatedAt: Date;
  /** Visible en el perfil del dueño y para cualquiera con el enlace. */
  isPublic: boolean;
}

export interface SavedDeck extends SavedDeckSummary {
  input: string;
  theme: string | null;
  locked: string[];
  excluded: string[];
}

export interface SaveDeckData {
  /** Si viene, actualiza ese mazo; si no, crea uno nuevo. */
  id?: string | undefined;
  name: string;
  input: string;
  source: string;
  theme: string | null;
  commanders: { oracleId: string; name: string }[];
  /** Las 99 (sin comandantes), ya resueltas. */
  cards: { oracleId: string; quantity: number }[];
  locked: string[];
  excluded: string[];
  /** Al crear: por defecto, público. Al actualizar, si no viene, se queda como estaba. */
  isPublic?: boolean | undefined;
}

export interface DeckRepository {
  list(): Promise<SavedDeckSummary[]>;
  get(id: string): Promise<SavedDeck | null>;
  /** Devuelve el id (uuid) del mazo creado o actualizado. */
  save(data: SaveDeckData): Promise<string>;
  delete(id: string): Promise<boolean>;
  setPublic(id: string, isPublic: boolean): Promise<boolean>;
  /** Copias de cada carta usadas en los mazos guardados, salvo `excludeDeckId`. */
  usage(excludeDeckId?: string): Promise<Map<string, CardUsage>>;
}
