import type { Bracket } from "../deck/bracket";
import type { DeckFacts } from "../deck/facts";
import type { DeckVisibility } from "../deck/visibility";
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
  /** Público (perfil y Comunidad), oculto (solo con el enlace) o privado. */
  visibility: DeckVisibility;
  /** Lo que me falta para este mazo entra en mi lista de deseos. */
  inWishlist: boolean;
}

export interface SavedDeck extends SavedDeckSummary {
  input: string;
  /** Bracket al que apunta (limita lo que se propone meter); null = sin objetivo. */
  targetBracket: Bracket | null;
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
  commanders: { oracleId: string; name: string; scryfallId?: string | null | undefined }[];
  /** Las 99 (sin comandantes), ya resueltas. `scryfallId`: la impresión pedida, si la hay. */
  cards: { oracleId: string; quantity: number; scryfallId?: string | null | undefined }[];
  locked: string[];
  excluded: string[];
  /** Al crear: por defecto, público. Al actualizar, si no viene, se queda como estaba. */
  visibility?: DeckVisibility | undefined;
  /** Si no viene, al crear queda sin objetivo y al actualizar no cambia. */
  targetBracket?: Bracket | null | undefined;
  /** Identidad y bracket para filtrar en Comunidad. */
  facts?: DeckFacts | undefined;
}

export interface DeckRepository {
  list(): Promise<SavedDeckSummary[]>;
  get(id: string): Promise<SavedDeck | null>;
  /** Devuelve el id (uuid) del mazo creado o actualizado. */
  save(data: SaveDeckData): Promise<string>;
  delete(id: string): Promise<boolean>;
  setVisibility(id: string, visibility: DeckVisibility): Promise<boolean>;
  rename(id: string, name: string): Promise<boolean>;
  setTargetBracket(id: string, bracket: Bracket | null): Promise<boolean>;
  setInWishlist(id: string, inWishlist: boolean): Promise<boolean>;
  /** Copias que piden (comandantes incluidos) los mazos que están en la lista de deseos. */
  wishlistDeckCards(): Promise<Map<string, number>>;
  /** Copias de cada carta usadas en los mazos guardados, salvo `excludeDeckId`. */
  usage(excludeDeckId?: string): Promise<Map<string, CardUsage>>;
}
