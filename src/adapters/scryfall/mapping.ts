import { z } from "zod";
import { COLORS, type Card, type Color, type Printing } from "@/domain/cards/types";

const imageUris = z.object({ normal: z.string().optional() }).partial().optional();

const face = z.object({
  name: z.string().optional(),
  oracle_id: z.string().optional(),
  mana_cost: z.string().optional(),
  type_line: z.string().optional(),
  oracle_text: z.string().optional(),
  image_uris: imageUris,
});

/** Subconjunto del objeto Card de Scryfall que usamos. El resto de campos se ignora. */
export const scryfallCardSchema = z.object({
  id: z.string(),
  oracle_id: z.string().optional(),
  name: z.string(),
  lang: z.string().default("en"),
  layout: z.string(),
  set: z.string(),
  collector_number: z.string(),
  mana_cost: z.string().optional(),
  cmc: z.number().optional(),
  type_line: z.string().optional(),
  oracle_text: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  color_identity: z.array(z.string()).default([]),
  legalities: z.record(z.string(), z.string()).default({}),
  edhrec_rank: z.number().optional(),
  prices: z.looseObject({ eur: z.string().nullish() }).nullish(),
  image_uris: imageUris,
  card_faces: z.array(face).optional(),
});

export type ScryfallCard = z.infer<typeof scryfallCardSchema>;

const joinFaces = (
  faces: ScryfallCard["card_faces"],
  key: "mana_cost" | "type_line" | "oracle_text",
  sep: string,
) => {
  const parts = (faces ?? [])
    .map((f) => f[key])
    .filter((v): v is string => v !== undefined && v !== "");
  return parts.length > 0 ? parts.join(sep) : null;
};

/** Las cartas "reversible" no tienen oracle_id arriba, sino en cada cara. */
const oracleIdOf = (c: ScryfallCard) => c.oracle_id ?? c.card_faces?.[0]?.oracle_id ?? null;

const imageOf = (c: ScryfallCard) =>
  c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;

export function toCard(c: ScryfallCard): Card | null {
  const oracleId = oracleIdOf(c);
  if (!oracleId) return null;
  const typeLine = c.type_line ?? joinFaces(c.card_faces, "type_line", " // ") ?? "";
  return {
    oracleId,
    name: c.name,
    frontFaceName: c.name.includes("//") ? (c.name.split("//")[0]?.trim() ?? null) : null,
    layout: c.layout,
    manaCost:
      c.mana_cost !== undefined && c.mana_cost !== ""
        ? c.mana_cost
        : joinFaces(c.card_faces, "mana_cost", " // "),
    cmc: c.cmc ?? 0,
    typeLine,
    oracleText: c.oracle_text ?? joinFaces(c.card_faces, "oracle_text", "\n//\n"),
    keywords: c.keywords,
    colorIdentity: COLORS.filter((col): col is Color => c.color_identity.includes(col)),
    legalCommander: c.legalities["commander"] === "legal",
    isBasicLand: /\bBasic\b/.test(typeLine) && /\bLand\b/.test(typeLine),
    edhrecRank: c.edhrec_rank ?? null,
    imageUrl: imageOf(c),
  };
}

function parsePrice(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toPrinting(c: ScryfallCard): Printing | null {
  const oracleId = oracleIdOf(c);
  if (!oracleId) return null;
  return {
    scryfallId: c.id,
    oracleId,
    setCode: c.set.toLowerCase(),
    collectorNumber: c.collector_number,
    lang: c.lang,
    imageUrl: imageOf(c),
    priceEur: parsePrice(c.prices?.eur),
  };
}

/** Versiones tolerantes: devuelven null si el objeto no cumple el esquema. */
export const safeMappers = {
  toCard: (raw: unknown) => {
    const r = scryfallCardSchema.safeParse(raw);
    return r.success ? toCard(r.data) : null;
  },
  toPrinting: (raw: unknown) => {
    const r = scryfallCardSchema.safeParse(raw);
    return r.success ? toPrinting(r.data) : null;
  },
};
