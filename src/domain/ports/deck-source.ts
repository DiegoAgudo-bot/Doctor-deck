import type { ParsedDecklist } from "../deck/decklist";

/** Origen de una lista de mazo: texto pegado (MVP), Archidekt, Moxfield… */
export interface DeckSource {
  readonly id: string;
  canHandle(input: string): boolean;
  load(input: string): Promise<ParsedDecklist>;
}
