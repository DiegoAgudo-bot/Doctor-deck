import type { CardUsage } from "../suggestions/engine";

export interface SavedDeckSummary {
  id: number;
  name: string;
  source: string;
  commanderNames: string[];
  /** oracleIds de los comandantes. */
  commanders: string[];
  cardCount: number;
  updatedAt: Date;
}

export interface SavedDeck extends SavedDeckSummary {
  input: string;
  theme: string | null;
  locked: string[];
  excluded: string[];
}

export interface SaveDeckData {
  /** Si viene, actualiza ese mazo; si no, crea uno nuevo. */
  id?: number | undefined;
  name: string;
  input: string;
  source: string;
  theme: string | null;
  commanders: { oracleId: string; name: string }[];
  /** Las 99 (sin comandantes), ya resueltas. */
  cards: { oracleId: string; quantity: number }[];
  locked: string[];
  excluded: string[];
}

export interface DeckRepository {
  list(): Promise<SavedDeckSummary[]>;
  get(id: number): Promise<SavedDeck | null>;
  save(data: SaveDeckData): Promise<number>;
  delete(id: number): Promise<boolean>;
  /** Copias de cada carta usadas en los mazos guardados, salvo `excludeDeckId`. */
  usage(excludeDeckId?: number): Promise<Map<string, CardUsage>>;
}
