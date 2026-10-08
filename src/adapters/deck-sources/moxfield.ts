import { z } from "zod";
import type { DecklistEntry, ParsedDecklist } from "@/domain/deck/decklist";
import type { DeckSource } from "@/domain/ports/deck-source";
import type { HttpClient } from "../http/http-client";
import { DeckSourceError } from "./errors";
import { fetchDeckJson } from "./fetch-json";

/*
 * Moxfield NO tiene API oficial; usamos el JSON que carga su web y puede fallar o bloquearse en
 * cualquier momento. Si falla, se avisa al usuario (que puede pegar la lista como texto); no se
 * intenta esquivar ningún bloqueo.
 *   v3: https://api2.moxfield.com/v3/decks/all/{publicId}
 *       { name, boards: { commanders: { cards: { <id>: { quantity, card } } }, mainboard: {…}, … } }
 *   v2 (formato antiguo, también aceptado): { name, commanders: { <nombre>: { quantity, card } }, mainboard: {…} }
 *   card: { name, scryfall_id, set, cn }
 */

const URL_RE = /^\s*https?:\/\/(?:www\.)?moxfield\.com\/decks\/([A-Za-z0-9_-]+)/i;

const entrySchema = z.looseObject({
  quantity: z.number().int().nonnegative(),
  card: z.looseObject({
    name: z.string().min(1),
    scryfall_id: z.string().nullish(),
    set: z.string().nullish(),
    cn: z.string().nullish(),
  }),
});
const entries = z.record(z.string(), entrySchema);

const v3 = z.looseObject({
  name: z.string().nullish(),
  boards: z.record(z.string(), z.looseObject({ cards: entries })),
});
const v2 = z.looseObject({
  name: z.string().nullish(),
  mainboard: entries,
  commanders: entries.nullish(),
  sideboard: entries.nullish(),
  maybeboard: entries.nullish(),
  companions: entries.nullish(),
});

/** Tableros que forman el mazo; el resto (sideboard, maybeboard, companions, tokens…) se ignora. */
const IN_DECK = new Set(["mainboard", "commanders"]);

export function parseMoxfieldDeck(json: unknown, url?: string): ParsedDecklist {
  let name: string | null = null;
  let boards: Record<string, Record<string, z.infer<typeof entrySchema>>>;
  const a = v3.safeParse(json);
  if (a.success) {
    name = a.data.name ?? null;
    boards = Object.fromEntries(Object.entries(a.data.boards).map(([k, b]) => [k, b.cards]));
  } else {
    const b = v2.safeParse(json);
    if (!b.success) {
      throw new DeckSourceError(
        "format",
        "moxfield",
        `La respuesta de Moxfield no tiene la estructura esperada (¿ha cambiado su formato?):\n${z.prettifyError(a.error)}`,
        url,
      );
    }
    name = b.data.name ?? null;
    const { mainboard, commanders, sideboard, maybeboard, companions } = b.data;
    boards = {
      mainboard,
      commanders: commanders ?? {},
      sideboard: sideboard ?? {},
      maybeboard: maybeboard ?? {},
      companions: companions ?? {},
    };
  }

  const out: DecklistEntry[] = [];
  const skipped: ParsedDecklist["skipped"] = [];
  let line = 0;
  for (const [board, cards] of Object.entries(boards)) {
    for (const { quantity, card } of Object.values(cards)) {
      line += 1;
      if (quantity === 0) continue;
      if (!IN_DECK.has(board)) {
        skipped.push({
          line,
          text: `${quantity} ${card.name}`,
          reason: `Fuera del mazo (${board})`,
        });
        continue;
      }
      out.push({
        line,
        quantity,
        name: card.name,
        setCode: card.set?.toLowerCase() ?? null,
        collectorNumber: card.cn ?? null,
        scryfallId: card.scryfall_id ?? null,
        foil: false,
        commander: board === "commanders",
      });
    }
  }
  return { name, entries: out, skipped };
}

export function moxfieldDeckSource(http: HttpClient): DeckSource {
  return {
    id: "moxfield",
    canHandle: (input) => URL_RE.test(input),
    async load(input) {
      const id = URL_RE.exec(input)?.[1];
      const url = `https://api2.moxfield.com/v3/decks/all/${id}`;
      return parseMoxfieldDeck(await fetchDeckJson(http, url, "moxfield"), url);
    },
  };
}
