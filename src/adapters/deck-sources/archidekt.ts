import { z } from "zod";
import type { DecklistEntry, ParsedDecklist } from "@/domain/deck/decklist";
import type { DeckSource } from "@/domain/ports/deck-source";
import type { HttpClient } from "../http/http-client";
import { DeckSourceError } from "./errors";
import { fetchDeckJson } from "./fetch-json";

/*
 * Archidekt tiene un endpoint JSON público: https://archidekt.com/api/decks/{id}/
 * Forma que usamos (el resto se ignora):
 *   { name, categories: [{ name, includedInDeck }],
 *     cards: [{ quantity, categories: ["Commander", ...],
 *               card: { uid (Scryfall ID), collectorNumber, edition: { editioncode },
 *                       oracleCard: { name } } }] }
 * La primera categoría de cada carta es la principal: si esa categoría no se incluye en el mazo
 * (Maybeboard, Sideboard…), la carta se ignora.
 */

const URL_RE = /^\s*https?:\/\/(?:www\.)?archidekt\.com\/(?:api\/)?decks\/(\d+)/i;

const schema = z.looseObject({
  name: z.string().nullish(),
  categories: z
    .array(z.looseObject({ name: z.string(), includedInDeck: z.boolean().nullish() }))
    .nullish(),
  cards: z.array(
    z.looseObject({
      quantity: z.number().int().nonnegative(),
      categories: z.array(z.string()).nullish(),
      card: z.looseObject({
        uid: z.string().nullish(),
        collectorNumber: z.string().nullish(),
        edition: z.looseObject({ editioncode: z.string().nullish() }).nullish(),
        oracleCard: z.looseObject({ name: z.string().min(1) }),
      }),
    }),
  ),
});

export function parseArchidektDeck(json: unknown, url?: string): ParsedDecklist {
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new DeckSourceError(
      "format",
      "archidekt",
      `La respuesta de Archidekt no tiene la estructura esperada (¿ha cambiado su formato?):\n${z.prettifyError(parsed.error)}`,
      url,
    );
  }
  const excluded = new Set(
    (parsed.data.categories ?? [])
      .filter((c) => c.includedInDeck === false)
      .map((c) => c.name.toLowerCase()),
  );
  const entries: DecklistEntry[] = [];
  const skipped: ParsedDecklist["skipped"] = [];
  parsed.data.cards.forEach((c, idx) => {
    const name = c.card.oracleCard.name;
    const cats = (c.categories ?? []).map((x) => x.toLowerCase());
    const primary = cats[0];
    if (c.quantity === 0) return;
    if (primary && excluded.has(primary)) {
      skipped.push({
        line: idx + 1,
        text: `${c.quantity} ${name}`,
        reason: `Fuera del mazo (${c.categories?.[0]})`,
      });
      return;
    }
    entries.push({
      line: idx + 1,
      quantity: c.quantity,
      name,
      setCode: c.card.edition?.editioncode?.toLowerCase() ?? null,
      collectorNumber: c.card.collectorNumber ?? null,
      scryfallId: c.card.uid ?? null,
      foil: false,
      commander: cats.includes("commander"),
    });
  });
  return { name: parsed.data.name ?? null, entries, skipped };
}

export function archidektDeckSource(http: HttpClient): DeckSource {
  return {
    id: "archidekt",
    canHandle: (input) => URL_RE.test(input),
    async load(input) {
      const id = URL_RE.exec(input)?.[1];
      const url = `https://archidekt.com/api/decks/${id}/`;
      return parseArchidektDeck(await fetchDeckJson(http, url, "archidekt"), url);
    },
  };
}
