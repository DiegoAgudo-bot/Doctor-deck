import { z } from "zod";
import { EdhrecError } from "./errors";

/*
 * JSON de json.edhrec.com/pages/average-decks/{slug}[/{tema}].json (no oficial). Solo nos importa:
 *   { deck: { commander_v2?: [[nombre, n]], commander?: [nombre],
 *             cards: { "Creature": [[nombre, n], …], "Land": […], … } } }
 * o bien { redirect: "/average-decks/otro-slug" }.
 */
const entry = z.tuple([z.string().min(1), z.number().int().positive()]);

const deckSchema = z.looseObject({
  deck: z.looseObject({
    commander_v2: z.array(entry).nullish(),
    commander: z.array(z.string().min(1)).nullish(),
    cards: z.record(z.string(), z.array(entry)),
  }),
});

const redirectSchema = z.object({
  redirect: z.string().regex(/^\/average-decks\/[a-z0-9-]+(\/[a-z0-9-]+)?$/),
});

export interface ParsedAverageDeck {
  commanders: string[];
  cards: { name: string; quantity: number }[];
}

export type AverageDeckOrRedirect =
  { kind: "page"; page: ParsedAverageDeck } | { kind: "redirect"; path: string };

/** Interpreta un mazo medio de EDHREC. Lanza EdhrecError("format") si no encaja. */
export function parseAverageDeck(body: string, url?: string): AverageDeckOrRedirect {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new EdhrecError("format", "EDHREC no ha devuelto JSON válido", url);
  }
  const redirect = redirectSchema.safeParse(json);
  if (redirect.success) return { kind: "redirect", path: redirect.data.redirect };

  const parsed = deckSchema.safeParse(json);
  if (!parsed.success) {
    throw new EdhrecError(
      "format",
      `El mazo medio de EDHREC no tiene la estructura esperada (¿ha cambiado su formato?):\n${z.prettifyError(parsed.error)}`,
      url,
    );
  }
  const { deck } = parsed.data;
  const commanders = deck.commander_v2?.map(([name]) => name) ?? deck.commander ?? [];
  // Una carta puede salir en dos grupos (p. ej. criatura artefacto): se suma una sola vez.
  const byName = new Map<string, number>();
  for (const list of Object.values(deck.cards)) {
    for (const [name, quantity] of list) {
      if (commanders.includes(name)) continue;
      byName.set(name, Math.max(byName.get(name) ?? 0, quantity));
    }
  }
  if (byName.size === 0) {
    throw new EdhrecError("format", "El mazo medio de EDHREC está vacío", url);
  }
  return {
    kind: "page",
    page: { commanders, cards: [...byName].map(([name, quantity]) => ({ name, quantity })) },
  };
}
