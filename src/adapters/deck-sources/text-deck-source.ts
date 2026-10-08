import { parseDecklist } from "@/domain/deck/decklist";
import type { DeckSource } from "@/domain/ports/deck-source";

/** Lista pegada como texto. Acepta cualquier entrada que no sea una URL. */
export const textDeckSource: DeckSource = {
  id: "text",
  canHandle: (input) => !/^\s*https?:\/\//i.test(input),
  load: async (input) => parseDecklist(input),
};
