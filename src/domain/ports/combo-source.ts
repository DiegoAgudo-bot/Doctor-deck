import type { DeckCombos } from "../combos/types";

/** Un mazo tal y como se le pasa a la fuente de combos: nombres de carta y copias. */
export interface ComboQuery {
  commanders: string[];
  main: { name: string; quantity: number }[];
}

/** Fuente de combos (Commander Spellbook). Si falla, lanza `ComboSourceError` (adaptador). */
export interface ComboSource {
  findCombos(deck: ComboQuery): Promise<DeckCombos>;
}
